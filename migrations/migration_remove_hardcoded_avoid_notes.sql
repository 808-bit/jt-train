-- Remove hardcoded "AVOID" text from exercise/progression_rules notes.
-- shoulder_safe=0 + the active-injury filter (js/app.js hasShoulderInjury())
-- already excludes these exercises when a shoulder injury is logged — that's
-- the single source of truth. Notes should describe the movement, not
-- duplicate a safety directive that belongs to the injury filter alone.

UPDATE exercises SET notes = 'Clean to rack position, then press overhead.' WHERE id = 'kb_clean_and_press';
UPDATE exercises SET notes = 'Slight knee dip drives bell past shoulder sticking point.' WHERE id = 'kb_push_press';
UPDATE exercises SET notes = 'Front squat into overhead press in one continuous motion.' WHERE id = 'kb_thruster';
UPDATE exercises SET notes = 'Strict single-arm overhead press.' WHERE id = 'single_arm_kb_press';

UPDATE progression_rules SET notes = 'Strict press strength established — add leg drive for push press.' WHERE exercise_id = 'single_arm_kb_press';
UPDATE progression_rules SET notes = 'Push press mastered — add the clean to press from the floor.' WHERE exercise_id = 'kb_push_press';
UPDATE progression_rules SET notes = 'Clean and press mastered — integrate squat into the press.' WHERE exercise_id = 'kb_clean_and_press';
UPDATE progression_rules SET notes = 'Thruster mastered — combine into the full complex.' WHERE exercise_id = 'kb_thruster';
UPDATE progression_rules SET notes = 'Ceiling of the overhead branch — full complex integrating clean, press, and squat.' WHERE exercise_id = 'kb_armor_complex';
