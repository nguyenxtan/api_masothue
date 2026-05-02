import { Router } from "express";
import { taxLookupHandler } from "../controllers/taxLookup.controller";

const router = Router();

router.post("/tax-lookup", taxLookupHandler);

export default router;
