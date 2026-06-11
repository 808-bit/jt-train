-- JT.TRAIN — Exercise Seed Data (56 exercises)
-- Run after schema.sql:
--   wrangler d1 execute jt-train-db --file=exercises_seed.sql  (remote)
--   wrangler d1 execute jt-train-db --local --file=exercises_seed.sql  (local test)

INSERT INTO exercises (id, display_name, category, equipment, movement_pattern, session_types, bilateral, home_available, shoulder_safe, notes) VALUES

-- ── Pull ──────────────────────────────────────────────────────────────────────
('band_assisted_chin_ups',      'Band Assisted Chin Ups',         'Pull',       'Band+BW',       'pull',   'Upper;Full Body A;Full Body B;Rings Only',          1, 1, 1, ''),
('band_assisted_ring_pull_ups', 'Band-Assisted Ring Pull Ups',    'Pull',       'Rings+Band',    'pull',   'Upper;Full Body A;Full Body B;Rings Only',          1, 0, 1, 'Traps may fire at top'),
('deep_ring_rows',              'Deep Ring Rows',                 'Pull',       'Rings',         'pull',   'Upper;Full Body A;Rings Only',                      1, 0, 1, 'Near-horizontal. 2s pause at top.'),
('false_grip_ring_rows',        'False Grip Ring Rows',           'Pull',       'Rings',         'pull',   'Upper;Full Body A;Rings Only',                      1, 0, 1, 'Higher rings for shoulder support'),
('kb_hip_hinge_row',            'KB Hip Hinge Row',               'Pull',       'KB',            'pull',   'Upper;Full Body A;Full Body B;KB Only',             0, 1, 1, 'Hinge forward — pull to hip. Per arm.'),
('kb_renegade_row',             'KB Renegade Row',                'Pull+Core',  'KB',            'pull',   'Upper;Full Body A;Full Body B;KB Only',             1, 1, 1, 'Plank position. Alternate arms. Anti-rotation core.'),
('kb_row',                      'KB Row',                         'Pull',       'KB',            'pull',   'Upper;Full Body A;Full Body B;KB Only',             0, 1, 1, 'Per arm'),
('pull_ups',                    'Pull Ups',                       'Pull',       'BW',            'pull',   'Upper;Full Body A;Full Body B;Rings Only',          1, 1, 1, ''),
('ring_muscle_up',              'Ring Muscle Up',                 'Pull+Push',  'Rings',         'pull',   'Rings Only',                                        1, 0, 0, 'Advanced. Only when shoulder fully resolved.'),
('ring_pull_ups',               'Ring Pull Ups',                  'Pull',       'Rings',         'pull',   'Upper;Full Body A;Full Body B;Rings Only',          1, 0, 1, ''),
('ring_rows',                   'Ring Rows',                      'Pull',       'Rings',         'pull',   'Upper;Full Body A;Full Body B;Rings Only',          1, 0, 1, 'Steeper angle = harder'),

-- ── Push ──────────────────────────────────────────────────────────────────────
('banded_tricep_pushdowns',         'Banded Tricep Pushdowns',          'Push',       'Band',          'push',   'Upper;Push Only',                                   1, 1, 1, ''),
('kb_floor_press',                  'KB Floor Press',                   'Push',       'KB',            'push',   'Upper;Full Body A;Full Body B;KB Only',             0, 1, 1, 'Corkscrew technique for right shoulder. 3-0-1-0.'),
('neutral_grip_parallette_pushups', 'Neutral Grip Parallette Push-ups', 'Push',       'Parallettes',   'push',   'Upper;Full Body A;Full Body B;Push Only',           1, 1, 1, 'Elbows tucked. 3-0-1-0.'),
('parallette_dips',                 'Parallette Dips',                  'Push',       'Parallettes',   'push',   'Upper;Full Body A;Full Body B;Push Only',           1, 1, 1, 'Safer than ring dips for shoulder'),
('parallette_pushups',              'Parallette Push-ups',              'Push',       'Parallettes',   'push',   'Upper;Full Body A;Full Body B;Push Only',           1, 1, 1, ''),
('pike_pushups',                    'Pike Push-ups',                    'Push',       'BW',            'push',   'Upper;Push Only',                                   1, 1, 0, 'CAUTION — overhead loading. Monitor shoulder.'),
('push_ups',                        'Push-ups',                         'Push',       'BW',            'push',   'Upper;Full Body A;Full Body B;Push Only',           1, 1, 1, ''),
('ring_archer_pushups',             'Ring Archer Push-ups',             'Push',       'Rings',         'push',   'Rings Only',                                        0, 0, 0, 'CAUTION — shoulder load. Monitor impingement.'),
('ring_dips',                       'Ring Dips',                        'Push',       'Rings+Band',    'push',   'Rings Only',                                        1, 0, 0, 'Avoid with active impingement.'),
('ring_pushups',                    'Ring Push-ups',                    'Push',       'Rings',         'push',   'Upper;Full Body A;Full Body B;Rings Only',          1, 0, 1, ''),
('single_arm_kb_press',             'Single Arm KB Press',              'Push',       'KB',            'push',   'Upper;Push Only',                                   0, 1, 0, 'AVOID overhead with active impingement'),

-- ── Avoid (overhead/high-risk) ────────────────────────────────────────────────
('kb_clean_and_press', 'KB Clean and Press', 'Push+Hinge', 'KB', 'hinge', 'Full Body A;Full Body B;KB Only', 0, 1, 0, 'AVOID — overhead press. Right shoulder impingement risk.'),
('kb_thruster',        'KB Thruster',        'Push+Legs',  'KB', 'squat', 'Full Body A;KB Only',             1, 1, 0, 'AVOID — overhead. Right shoulder impingement risk.'),

-- ── Hinge ─────────────────────────────────────────────────────────────────────
('double_kb_clean',      'Double KB Clean',         'Hinge', 'KB', 'hinge', 'Full Body A;Full Body B;KB Only',             1, 1, 0, 'Power movement. No shoulder impingement risk if kept below shoulder height.'),
('double_kb_deadlift',   'Double KB Deadlift',      'Hinge', 'KB', 'hinge', 'Lower;Full Body A;Full Body B;KB Only',       1, 1, 1, ''),
('double_kb_swing',      'Double KB Swing',         'Hinge', 'KB', 'hinge', 'Full Body A;Full Body B;KB Only',             1, 1, 1, 'Hip hinge power. Keep arms relaxed.'),
('kb_deadlift',          'KB Deadlift',             'Hinge', 'KB', 'hinge', 'Lower;Full Body A;Full Body B;KB Only',       1, 1, 1, 'Single KB bilateral deadlift'),
('kb_single_leg_deadlift','KB Single Leg Deadlift', 'Hinge', 'KB', 'hinge', 'Lower;Full Body B;KB Only',                  0, 1, 1, ''),
('kb_suitcase_rdl',      'KB Suitcase RDL',         'Hinge', 'KB', 'hinge', 'Lower;Full Body A;Full Body B;KB Only',       0, 1, 1, '3-2-1-0 tempo. 2s pause at bottom.'),
('kb_swing',             'KB Swing',                'Hinge', 'KB', 'hinge', 'Full Body A;Full Body B;KB Only',             0, 1, 1, 'Single arm. Hip hinge power.'),
('single_leg_kb_rdl',    'Single Leg KB RDL',       'Hinge', 'KB', 'hinge', 'Lower;Full Body B;KB Only',                  0, 1, 1, ''),
('windmill_kb',          'KB Windmill',             'Core+Hinge','KB','hinge','Full Body A;Full Body B',                   0, 1, 0, 'CAUTION — shoulder overhead. Avoid with impingement.'),

-- ── Legs / Squat ──────────────────────────────────────────────────────────────
('bulgarian_split_squat',   'Bulgarian Split Squat',  'Legs', 'KB',     'lunge', 'Lower;Full Body A;Full Body B;KB Only',  0, 1, 1, 'Suitcase hold. 3-0-1-0 tempo.'),
('cossack_squat',           'Cossack Squat',          'Legs', 'KB+BW',  'squat', 'Lower;Full Body A;Full Body B;KB Only',  0, 1, 1, ''),
('double_kb_front_squat',   'Double KB Front Squat',  'Legs', 'KB',     'squat', 'Lower;Full Body A;Full Body B;KB Only',  1, 1, 1, 'Asymmetric load — switch sides each set'),
('goblet_squat',            'Goblet Squat',           'Legs', 'KB',     'squat', 'Lower;Full Body A;Full Body B;KB Only',  1, 1, 1, ''),
('kb_goblet_reverse_lunge', 'KB Goblet Reverse Lunge','Legs', 'KB',     'lunge', 'Lower;Full Body B;KB Only',              0, 1, 1, ''),
('kb_lateral_lunge',        'KB Lateral Lunge',       'Legs', 'KB',     'lunge', 'Lower;Full Body B;KB Only',              0, 1, 1, ''),
('kb_squat',                'KB Squat',               'Legs', 'KB',     'squat', 'Lower;Full Body A;KB Only',              1, 1, 1, ''),
('racked_squat',            'Racked Squat',           'Legs', 'KB',     'squat', 'Lower;Full Body A;Full Body B;KB Only',  1, 1, 1, 'Asymmetric loads — switch sides each set'),
('walking_lunges_kb',       'KB Walking Lunges',      'Legs', 'KB',     'lunge', 'Lower;Full Body B;KB Only',              0, 1, 1, 'Suitcase or goblet hold'),

-- ── Carry ─────────────────────────────────────────────────────────────────────
('kb_farmers_carry',  'KB Farmers Carry',  'Carry', 'KB', 'carry', 'Full Body A;Full Body B;KB Only', 0, 1, 1, 'Per arm or bilateral. Core + grip.'),
('kb_suitcase_carry', 'KB Suitcase Carry', 'Carry', 'KB', 'carry', 'Full Body A;Full Body B;KB Only', 0, 1, 1, 'Lateral stability. Per side.'),

-- ── Core ──────────────────────────────────────────────────────────────────────
('kb_halos',           'KB Halos',               'Core+Rehab', 'KB',              'core', 'Full Body A;Full Body B;KB Only',          1, 1, 1, 'Shoulder mobility. Light weight.'),
('l_sit',              'L-Sit',                  'Core',       'Parallettes+BW',  'core', 'Full Body A;Full Body B;Rings Only',       1, 1, 1, 'Tuck first. Progress to full L-sit.'),
('parallette_l_sit',   'Parallette L-Sit',       'Core',       'Parallettes',     'core', 'Full Body A;Full Body B',                  1, 1, 1, 'Tuck hold then extend'),
('ring_body_saw',      'Ring Body Saw',           'Core',       'Rings',           'core', 'Full Body A;Full Body B;Rings Only',       1, 0, 1, 'Feet in rings. Pike and extend. Brutal core.'),
('ring_knee_raises',   'Ring Knee Raises',        'Core',       'Rings',           'core', 'Full Body A;Full Body B;Rings Only',       1, 0, 1, 'Progress to leg raises'),
('ring_l_sit',         'Ring L-Sit',              'Core',       'Rings',           'core', 'Rings Only',                               1, 0, 1, 'Support hold then extend legs'),
('ring_support_hold',  'Ring Support Hold',       'Core+Rehab', 'Rings',           'core', 'Rings Only',                               1, 0, 1, 'Shoulder stability. Protraction/depression cue.'),
('support_hold',       'Parallette Support Hold', 'Core',       'Parallettes',     'core', 'Full Body A;Full Body B',                  1, 1, 1, 'Shoulder depression + protraction cue'),

-- ── Rehab ─────────────────────────────────────────────────────────────────────
('banded_face_pulls',   'Banded Face Pulls',  'Rehab', 'Band',      'rehab', 'Upper;Rehab',            1, 1, 1, 'Stop if traps fire'),
('banded_pull_aparts',  'Banded Pull Aparts', 'Rehab', 'Band',      'rehab', 'Upper;Rehab',            1, 1, 1, 'Scapular health'),
('passive_dead_hangs',  'Passive Dead Hangs', 'Rehab', 'Rings+BW',  'rehab', 'Rehab',                  1, 0, 1, 'Shoulder decompression. 30-45s.'),
('ring_face_pulls',     'Ring Face Pulls',    'Rehab', 'Rings',     'rehab', 'Upper;Rehab;Rings Only', 1, 0, 1, 'Better than band face pulls — more range.');

-- ── Add bilateral column (if not in original schema.sql) ─────────────────────
-- If schema.sql already has bilateral, remove the two lines below
-- ALTER TABLE exercises ADD COLUMN bilateral INTEGER DEFAULT 1;
