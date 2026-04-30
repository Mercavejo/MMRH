import { listPlansInDb } from "../infrastructure/plans-repository";

export async function listCommercialPlans() {
  return listPlansInDb();
}
