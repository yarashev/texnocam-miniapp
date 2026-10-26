import { db } from './database.js';
import { createImageStorage } from './image-storage-provider.js';
const storage=createImageStorage(db);
export const initializeImageStorage=()=>storage.initialize();
export const saveProductImage=(bytes,ext)=>storage.save(bytes,ext);
export const loadProductImage=name=>storage.load(name);
export const imageStorageMode=()=>storage.mode();
