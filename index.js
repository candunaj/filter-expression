export const parser = 'ts';

function removeImport(ast, j){
  ast.find(j.ImportDeclaration, {
    source: {
      value: 'cing-app/mixins/filter-builder'
    }
  }).forEach(path => {
    path.prune();
  });
}


function ensureImport(ast, j, importName, defaultImportName){
  if(!ast.find(j.Program).length){
    return;
  }
  // import QueryOperators if not imported
  // import { QueryOperators } from 'smex-ui-models/utils/query-builder';

  const importDeclarations = ast.find(j.ImportDeclaration, {
    source: {
      value: 'smex-ui-models/utils/query-builder'
    }
  });

  if(importDeclarations.length){
    if(defaultImportName){
      if(!importDeclarations.find(j.ImportDefaultSpecifier, {
        local: {
          name: defaultImportName
        }
      }).length){
        // import QueryOperators, { QueryOperators } from 'smex-ui-models/utils/query-builder';
        const importSpecifier = j.importDefaultSpecifier(j.identifier(defaultImportName));
        importDeclarations.nodes()[0].specifiers.unshift(importSpecifier);
      }
    }

    if(importName){
      const queryOperators = importDeclarations.find(j.ImportSpecifier, {
        imported: {
          name: importName
        }
      });

      if(!queryOperators.length){
        // import { QueryOperators } from 'smex-ui-models/utils/query-builder';
        const importSpecifier = j.importSpecifier(j.identifier(importName));
        importDeclarations.nodes()[0].specifiers.push(importSpecifier);
      }
    }
  }else{
    const imports = [];
    if(importName){
      imports.push(j.importSpecifier(j.identifier(importName)));
    }
    if(defaultImportName){
      imports.unshift(j.importDefaultSpecifier(j.identifier(defaultImportName)));
    }

    const importDeclaration = j.importDeclaration(
      imports,
      j.literal('smex-ui-models/utils/query-builder')
    );
    const programs = ast.find(j.Program).at(0);
    const program = programs.nodes()[0];
    program.body = [importDeclaration, ...program.body];
  }
}

function getDecorators(ast, j){
  let asts = [];
  ast.find(j.ClassProperty).forEach(path=>{
    if(path.node.decorators?.length){
      const dec = path.node.decorators.find(d=>d.expression?.arguments?.length);
      if(dec){
        asts.push(j(dec.expression.arguments[0]));
      }
    }
  });
  return asts;
}

function refactorCreate(ast, j, objectName, newObjectName, mainImport, getArguments){
  let somethingChanged = false;
  ast.find(j.CallExpression, {
    callee: {
      object:{
        name: objectName
      },
      property: {
        name: 'create',
      },
    }
  })
  .forEach(path => {
    // if(path.node?.callee?.object?.name === objectName && path.node?.callee?.property?.name === 'create'){
    somethingChanged = true;
      mainImport();
      const arg = path?.value.arguments?.[0];
      let filter;
      if(arg && arg.properties){
        const newArguments = getArguments(arg.properties);
        filter = j.newExpression(j.identifier(newObjectName), newArguments);
      }else{
        filter = j.newExpression(j.identifier(newObjectName), []);
      }
      path.replace(filter);
      // }
  });

  return somethingChanged;
}

function removeMixin(ast, j){
  ast.find(j.CallExpression, {
    callee: {
      property: {
        name: 'extend',
      },
    }
  }).forEach(path => {
    const filterBuilder = path.node.arguments.find(a => a.type === 'Identifier' && a.name === 'FilterBuilder');
    if(filterBuilder){
      path.node.arguments = path.node.arguments.filter(a => a !== filterBuilder);
    }

    if(path.node.arguments.length === 0){
      path.replace(j.identifier(path.node.callee.object.name));
    }
  });
}

// Press ctrl+space for code completion
export default function transformer(file, api) {
  const j = api.jscodeshift;

  const baseAst = j(file.source);
  const asts = [baseAst, ...getDecorators(baseAst, j)];

  let change = false;

  for(let ast of asts){
    const ch1 = refactorCreate(ast, j, 'Expressions', 'Query', ()=>ensureImport(ast, j, 'Query', undefined), (properties)=>{
      let operator = properties.find(p=>p?.key?.name==='operator')?.value;
      if(operator){
        ensureImport(ast, j, 'QueryOperators');
        operator.object.name = 'QueryOperators';
        return [operator]; 
      }
      return [];
    });

    const ch2 = refactorCreate(ast, j, 'Filter', 'Filter', ()=>ensureImport(ast, j, 'Filter'), (properties)=>{
      const name = properties.find(p=>p?.key?.name==='name')?.value ?? j.identifier('undefined');
      const operator = properties.find(p=>p?.key?.name==='operator')?.value ?? j.identifier('undefined');
      if(operator?.object?.name==='FilterOperators'){
        ensureImport(ast, j, 'FilterOperators');
      }
      const value = properties.find(p=>p?.key?.name==='value')?.value ?? j.identifier('undefined');
      return [name, operator, value];
    });

    const ch3 = refactorCreate(ast, j, 'RangeFilter', 'RangeFilter', ()=>ensureImport(ast, j, 'RangeFilter'), (properties)=>{
      // name, value1, value2
      const name = properties.find(p=>p?.key?.name==='name')?.value ?? j.identifier('undefined');
      const value1 = properties.find(p=>p?.key?.name==='value1')?.value ?? j.identifier('undefined');
      const value2 = properties.find(p=>p?.key?.name==='value2')?.value ?? j.identifier('undefined');
      return [name, value1, value2];
    });

    const ch4 = refactorCreate(ast, j, 'DateRangeFilter', 'DateRangeFilter', ()=>ensureImport(ast, j, 'DateRangeFilter'), (properties)=>{
      // name, value1, value2, dateFormat
      const name = properties.find(p=>p?.key?.name==='name')?.value ?? j.identifier('undefined');
      const value1 = properties.find(p=>p?.key?.name==='value1')?.value ?? j.identifier('undefined');
      const value2 = properties.find(p=>p?.key?.name==='value2')?.value ?? j.identifier('undefined');
      const dateFormat = properties.find(p=>p?.key?.name==='dateFormat')?.value ?? j.identifier('undefined');
      return [name, value1, value2, dateFormat];
    });

    if(ch1 || ch2 || ch3 || ch4){
      change = true;
    }
  }

  if(change){
    if(baseAst.find(j.Identifier, {
      name: 'FilterOperators',
    }).length){
      ensureImport(baseAst, j, 'FilterOperators');
    }

    removeImport(baseAst, j);
    removeMixin(baseAst, j);
  }

  const source = baseAst.toSource();
  return source;
  // console.log(source);
}