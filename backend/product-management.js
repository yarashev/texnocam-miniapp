import { db } from './database.js';
import { createProductManager } from './product-manager.js';
export const {listManagedProducts,getManagedProduct,saveManagedProduct,changeProductState,productError}=createProductManager(db);
