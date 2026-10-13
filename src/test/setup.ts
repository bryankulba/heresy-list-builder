// Tests read every army's units synchronously, as the app does once they're loaded
import { loadAllUnits } from '../data/loader';

await loadAllUnits();
