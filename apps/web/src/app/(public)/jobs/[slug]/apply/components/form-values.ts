import type { PersonalValues } from './PersonalFields';
import type { ProfessionalValues } from './ProfessionalFields';

export type ApplyFormValues = {
  candidate: PersonalValues;
  professional: ProfessionalValues;
  answers: Record<string, unknown>;
};
