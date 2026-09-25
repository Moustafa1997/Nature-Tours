const ApiFeatures = require('../../utils/apiFeatures');

// fake mongoose query that records the calls
const fakeQuery = () => {
  const calls = {};
  const q = {};
  ['find', 'sort', 'select', 'skip', 'limit'].forEach((m) => {
    q[m] = (arg) => {
      calls[m] = arg;
      return q;
    };
  });
  q.calls = calls;
  return q;
};

describe('ApiFeatures', () => {
  test('filter turns gte/gt/lte/lt into mongo operators and drops paging fields', () => {
    const q = fakeQuery();
    new ApiFeatures(q, {
      duration: { gte: '5' },
      price: { lt: '1500' },
      difficulty: 'easy',
      page: '2',
      sort: 'price',
      limit: '10',
      fields: 'name',
    }).filter();
    expect(q.calls.find).toEqual({
      duration: { $gte: '5' },
      price: { $lt: '1500' },
      difficulty: 'easy',
    });
  });

  test('sort, fields and pagination', () => {
    const q = fakeQuery();
    new ApiFeatures(q, {
      sort: '-price,ratingsAverage',
      fields: 'name,price',
      page: '3',
      limit: '10',
    })
      .sort()
      .limitFields()
      .paginate();
    expect(q.calls.sort).toBe('-price ratingsAverage');
    expect(q.calls.select).toBe('name price');
    expect(q.calls.skip).toBe(20);
    expect(q.calls.limit).toBe(10);
  });

  test('defaults', () => {
    const q = fakeQuery();
    new ApiFeatures(q, {}).sort().limitFields().paginate();
    expect(q.calls.sort).toBe('-createdAt');
    expect(q.calls.select).toBe('-__v');
    expect(q.calls.skip).toBe(0);
    expect(q.calls.limit).toBe(100);
  });
});
