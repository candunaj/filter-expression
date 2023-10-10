import {
  Expressions,
  ExpressionOperators,
  Filter,
  FilterOperators,
} from 'cing-app/mixins/filter-builder';


export default class AbClaim extends Component<AbClaimArgs> {
 
  @task
  loadLookups = taskFor(async () => {
    let query: any = {
      page: {
        size: 1000,
        number: 1,
      },
    };

    let condition = Expressions.create({
      operator: ExpressionOperators.AND,
    });

    let condition2 = Expressions.create();

    condition.add(
      Filter.create({
        name: criteria.field.name,
        operator: criteria.field.criteria,
        value:
          criteria.field.type == 'number' &&
          criteria.field.criteria != null
            ? criteria.field.value || 0
            : criteria.field.value || '',
      })
    );

    DateRangeFilter.create({
      dateFormat: this.config.get('APP.serverDateFormat'),
      name: 'original-date-filed',
      value1: dateRange.start,
      value2: dateRange.end,
    });
  });
}