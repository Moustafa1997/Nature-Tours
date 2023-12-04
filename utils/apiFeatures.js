class ApiFeatures {
  constructor(query, queryStr) {
    this.query = query;
    this.queryStr = queryStr;
  }
  filter() {
    const queryobj = { ...this.queryStr };
    //const expressions = [''];
    const excludeFields = ['page', 'sort', 'limit', 'fields'];

    excludeFields.forEach((el) => delete queryobj[el]);
    //2) advanced filter
    // to replace gte from query with $gte
    let queryString = JSON.stringify(queryobj);
    queryString = JSON.parse(
      queryString.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`),
    );
    //console.log(queryobj);
    this.query = this.query.find(queryString);

    return this;
  }
  sort() {
    if (this.queryStr.sort) {
      const sortBy = this.queryStr.sort.split(',').join(' ');
      //  console.log(sortBy);
      this.query = this.query.sort(sortBy);
    } else {
      this.query = this.query.sort('-createdAt');
    }
    return this;
  }
  limitFields() {
    if (this.queryStr.fields) {
      const fields = this.queryStr.fields.split(',').join(' ');
      //  console.log(sortBy);
      this.query = this.query.select(fields);
    } else {
      this.query = this.query.select('-__v');
    }
    return this;
  }
  paginate() {
    const page = this.queryStr.page * 1 || 1;
    const limit = this.queryStr.limit * 1 || 100;
    const skip = (page - 1) * limit;
    this.query = this.query.skip(skip).limit(limit);
    return this;
  }
}
//export
module.exports = ApiFeatures;
