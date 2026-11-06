import test from 'node:test';
import assert from 'node:assert/strict';
import { createProductManager } from '../backend/product-manager.js';

test('managed product listing validates page size and sort order', async () => {
  const queries=[];
  const db={
    async get(sql){if(sql.includes('COUNT(*)'))return {total:123};return null;},
    async all(sql,...values){
      queries.push({sql,values});
      if(sql.startsWith('SELECT DISTINCT brand'))return [{brand:'Seagate'}];
      if(sql.startsWith('SELECT name FROM categories'))return [{name:'Qattiq disk'}];
      return [];
    }
  };
  const {listManagedProducts}=createProductManager(db);
  let result=await listManagedProducts({id:1,role:'admin'},new URLSearchParams({page:'2',pageSize:'25',sort:'price_desc'}));
  assert.equal(result.total,123);assert.equal(result.page,2);assert.equal(result.pageSize,25);
  const productQuery=queries.find(item=>item.sql.includes('ORDER BY'));
  assert.match(productQuery.sql,/ORDER BY p\.sale_price_uzs DESC, p\.id DESC LIMIT \? OFFSET \?/);
  assert.deepEqual(productQuery.values.slice(-2),[25,25]);
  queries.length=0;
  result=await listManagedProducts({id:1,role:'admin'},new URLSearchParams({pageSize:'999',sort:'price_desc; DROP TABLE products'}));
  assert.equal(result.pageSize,10);
  const safeQuery=queries.find(item=>item.sql.includes('ORDER BY'));
  assert.match(safeQuery.sql,/ORDER BY p\.id DESC LIMIT \? OFFSET \?/);
  assert.doesNotMatch(safeQuery.sql,/DROP TABLE/i);
});
