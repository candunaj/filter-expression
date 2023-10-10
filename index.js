export const parser = 'tsx'

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


function refactorCreate(ast, j, objectName, newObjectName, mainImport, getArguments){
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
  });
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
      path.replace(j.identifier('Component'));
    }
  });
}

// Press ctrl+space for code completion
export default function transformer(file, api) {
  const j = api.jscodeshift;

  const ast = j(file.source);
  removeImport(ast, j);
  removeMixin(ast, j);
  refactorCreate(ast, j, 'Expressions', 'Query', ()=>ensureImport(ast, j, undefined, 'Query'), (properties)=>{
    let operator = properties.find(p=>p?.key?.name==='operator')?.value;
    if(operator){
      ensureImport(ast, j, 'QueryOperators');
      operator.object.name = 'QueryOperators';
      return [operator]; 
    }
    return [];
  });

  refactorCreate(ast, j, 'Filter', 'Filter', ()=>ensureImport(ast, j, 'Filter'), (properties)=>{
    const name = properties.find(p=>p?.key?.name==='name')?.value ?? j.identifier('undefined');
    const operator = properties.find(p=>p?.key?.name==='operator')?.value ?? j.identifier('undefined');
    if(operator?.object?.name==='FilterOperators'){
      ensureImport(ast, j, 'FilterOperators');
    }
    const value = properties.find(p=>p?.key?.name==='value')?.value ?? j.identifier('undefined');
    return [name, operator, value];
  });

  refactorCreate(ast, j, 'RangeFilter', 'RangeFilter', ()=>ensureImport(ast, j, 'RangeFilter'), (properties)=>{
    // name, value1, value2
    const name = properties.find(p=>p?.key?.name==='name')?.value ?? j.identifier('undefined');
    const value1 = properties.find(p=>p?.key?.name==='value1')?.value ?? j.identifier('undefined');
    const value2 = properties.find(p=>p?.key?.name==='value2')?.value ?? j.identifier('undefined');
    return [name, value1, value2];
  });

  refactorCreate(ast, j, 'DateRangeFilter', 'DateRangeFilter', ()=>ensureImport(ast, j, 'DateRangeFilter'), (properties)=>{
    // name, value1, value2, dateFormat
    const name = properties.find(p=>p?.key?.name==='name')?.value ?? j.identifier('undefined');
    const value1 = properties.find(p=>p?.key?.name==='value1')?.value ?? j.identifier('undefined');
    const value2 = properties.find(p=>p?.key?.name==='value2')?.value ?? j.identifier('undefined');
    const dateFormat = properties.find(p=>p?.key?.name==='dateFormat')?.value ?? j.identifier('undefined');
    return [name, value1, value2, dateFormat];
  });

  const source = ast.toSource();
  return source;
  // console.log(source);
}