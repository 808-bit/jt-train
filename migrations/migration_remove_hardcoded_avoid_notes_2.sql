-- Same cleanup as migration_remove_hardcoded_avoid_notes.sql, for
-- pre-existing exercises found with the same hardcoded avoid/impingement
-- text. shoulder_safe=0 already covers all of these.

UPDATE exercises SET notes = 'Unilateral loading shift — one hand elevated, weight shifted to the working side.' WHERE id = 'ring_archer_pushups';
UPDATE exercises SET notes = 'Full ROM dip on rings — instability adds to the vertical push demand.' WHERE id = 'ring_dips';
UPDATE exercises SET notes = 'Power movement. Keep below shoulder height for lowest joint stress.' WHERE id = 'double_kb_clean';
UPDATE exercises SET notes = 'Loaded overhead position with lateral flexion — bell held overhead throughout.' WHERE id = 'windmill_kb';
UPDATE exercises SET notes = 'Bell from floor to overhead in one continuous motion.' WHERE id = 'kb_snatch';

UPDATE progression_rules SET notes = 'Ceiling of the rings track — most advanced unilateral loading variation.' WHERE exercise_id = 'ring_archer_pushups';
