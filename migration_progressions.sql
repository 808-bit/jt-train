CREATE TABLE IF NOT EXISTS movement_patterns (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, focus TEXT, display_order INTEGER DEFAULT 0
);
INSERT OR IGNORE INTO movement_patterns (id, name, description, focus, display_order) VALUES
('mp_horiz_push','Horizontal Push','Chest, front deltoids, triceps, core stabilization','Chest-led pressing movements',1),
('mp_horiz_pull','Horizontal Pull','Lats, rhomboids, rear deltoids, grip','Rowing movements',2),
('mp_vert_pull','Vertical Pull','Lat thickness, biceps, shoulder health','Pull-up and chin-up patterns',3),
('mp_vert_push','Vertical Push','Deltoids, upper chest, triceps, overhead stability','Overhead pressing patterns',4),
('mp_posterior_hinge','Posterior Chain/Hinge','Glutes, hamstrings, spinal erectors, power','Hip hinge movements',5),
('mp_anterior_squat','Anterior Chain/Squat','Quads, hip mobility, unilateral leg strength','Squat and lunge patterns',6),
('mp_overhead_press','Overhead Press','Whole-body coordination, overhead lockout strength','Overhead KB pressing',7),
('mp_carry','Carry','Core stability, grip, loaded locomotion','Farmer and suitcase carries',8),
('mp_core','Core','Anterior chain, isometric strength, body control','L-sits, holds, body saws',9),
('mp_rehab','Rehabilitation','Joint health, rotator cuff, scapular stability','Shoulder and mobility work',10);
ALTER TABLE exercises ADD COLUMN movement_pattern_id TEXT REFERENCES movement_patterns(id);
ALTER TABLE exercises ADD COLUMN matrix_level INTEGER DEFAULT 1;
ALTER TABLE exercises ADD COLUMN modality TEXT DEFAULT 'calisthenics';
ALTER TABLE exercises ADD COLUMN parent_id TEXT REFERENCES exercises(id);
UPDATE exercises SET movement_pattern_id='mp_horiz_push', matrix_level=1, modality='calisthenics' WHERE id='push_ups';
UPDATE exercises SET movement_pattern_id='mp_horiz_push', matrix_level=2, modality='calisthenics' WHERE id='parallette_pushups';
UPDATE exercises SET movement_pattern_id='mp_horiz_push', matrix_level=2, modality='calisthenics' WHERE id='neutral_grip_parallette_pushups';
UPDATE exercises SET movement_pattern_id='mp_horiz_push', matrix_level=3, modality='calisthenics' WHERE id='ring_pushups';
UPDATE exercises SET movement_pattern_id='mp_horiz_push', matrix_level=4, modality='calisthenics' WHERE id='ring_archer_pushups';
UPDATE exercises SET movement_pattern_id='mp_horiz_push', matrix_level=2, modality='kettlebell' WHERE id='kb_floor_press';
UPDATE exercises SET movement_pattern_id='mp_horiz_push', matrix_level=1, modality='band' WHERE id='banded_tricep_pushdowns';
UPDATE exercises SET movement_pattern_id='mp_horiz_pull', matrix_level=1, modality='calisthenics' WHERE id='ring_rows';
UPDATE exercises SET movement_pattern_id='mp_horiz_pull', matrix_level=2, modality='calisthenics' WHERE id='deep_ring_rows';
UPDATE exercises SET movement_pattern_id='mp_horiz_pull', matrix_level=2, modality='calisthenics' WHERE id='false_grip_ring_rows';
UPDATE exercises SET movement_pattern_id='mp_horiz_pull', matrix_level=1, modality='kettlebell' WHERE id='kb_row';
UPDATE exercises SET movement_pattern_id='mp_horiz_pull', matrix_level=2, modality='kettlebell' WHERE id='kb_hip_hinge_row';
UPDATE exercises SET movement_pattern_id='mp_horiz_pull', matrix_level=3, modality='kettlebell' WHERE id='kb_renegade_row';
UPDATE exercises SET movement_pattern_id='mp_vert_pull', matrix_level=1, modality='calisthenics' WHERE id='band_assisted_chin_ups';
UPDATE exercises SET movement_pattern_id='mp_vert_pull', matrix_level=1, modality='calisthenics' WHERE id='band_assisted_ring_pull_ups';
UPDATE exercises SET movement_pattern_id='mp_vert_pull', matrix_level=2, modality='calisthenics' WHERE id='pull_ups';
UPDATE exercises SET movement_pattern_id='mp_vert_pull', matrix_level=3, modality='calisthenics' WHERE id='ring_pull_ups';
UPDATE exercises SET movement_pattern_id='mp_vert_pull', matrix_level=4, modality='calisthenics' WHERE id='ring_muscle_up';
UPDATE exercises SET movement_pattern_id='mp_vert_push', matrix_level=1, modality='calisthenics' WHERE id='pike_pushups';
UPDATE exercises SET movement_pattern_id='mp_vert_push', matrix_level=2, modality='calisthenics' WHERE id='parallette_dips';
UPDATE exercises SET movement_pattern_id='mp_vert_push', matrix_level=3, modality='calisthenics' WHERE id='ring_dips';
UPDATE exercises SET movement_pattern_id='mp_overhead_press', matrix_level=1, modality='kettlebell' WHERE id='single_arm_kb_press';
UPDATE exercises SET movement_pattern_id='mp_overhead_press', matrix_level=3, modality='kettlebell' WHERE id='kb_clean_and_press';
UPDATE exercises SET movement_pattern_id='mp_overhead_press', matrix_level=3, modality='hybrid' WHERE id='kb_thruster';
UPDATE exercises SET movement_pattern_id='mp_posterior_hinge', matrix_level=1, modality='kettlebell' WHERE id='kb_deadlift';
UPDATE exercises SET movement_pattern_id='mp_posterior_hinge', matrix_level=2, modality='kettlebell' WHERE id='double_kb_deadlift';
UPDATE exercises SET movement_pattern_id='mp_posterior_hinge', matrix_level=2, modality='kettlebell' WHERE id='kb_suitcase_rdl';
UPDATE exercises SET movement_pattern_id='mp_posterior_hinge', matrix_level=3, modality='kettlebell' WHERE id='single_leg_kb_rdl';
UPDATE exercises SET movement_pattern_id='mp_posterior_hinge', matrix_level=3, modality='kettlebell' WHERE id='kb_single_leg_deadlift';
UPDATE exercises SET movement_pattern_id='mp_posterior_hinge', matrix_level=2, modality='kettlebell' WHERE id='kb_swing';
UPDATE exercises SET movement_pattern_id='mp_posterior_hinge', matrix_level=3, modality='kettlebell' WHERE id='double_kb_swing';
UPDATE exercises SET movement_pattern_id='mp_posterior_hinge', matrix_level=3, modality='kettlebell' WHERE id='double_kb_clean';
UPDATE exercises SET movement_pattern_id='mp_posterior_hinge', matrix_level=3, modality='kettlebell' WHERE id='windmill_kb';
UPDATE exercises SET movement_pattern_id='mp_anterior_squat', matrix_level=1, modality='kettlebell' WHERE id='kb_squat';
UPDATE exercises SET movement_pattern_id='mp_anterior_squat', matrix_level=1, modality='kettlebell' WHERE id='goblet_squat';
UPDATE exercises SET movement_pattern_id='mp_anterior_squat', matrix_level=2, modality='kettlebell' WHERE id='double_kb_front_squat';
UPDATE exercises SET movement_pattern_id='mp_anterior_squat', matrix_level=2, modality='kettlebell' WHERE id='racked_squat';
UPDATE exercises SET movement_pattern_id='mp_anterior_squat', matrix_level=2, modality='kettlebell' WHERE id='kb_goblet_reverse_lunge';
UPDATE exercises SET movement_pattern_id='mp_anterior_squat', matrix_level=2, modality='kettlebell' WHERE id='walking_lunges_kb';
UPDATE exercises SET movement_pattern_id='mp_anterior_squat', matrix_level=3, modality='kettlebell' WHERE id='kb_lateral_lunge';
UPDATE exercises SET movement_pattern_id='mp_anterior_squat', matrix_level=3, modality='kettlebell' WHERE id='cossack_squat';
UPDATE exercises SET movement_pattern_id='mp_anterior_squat', matrix_level=4, modality='kettlebell' WHERE id='bulgarian_split_squat';
UPDATE exercises SET movement_pattern_id='mp_carry', matrix_level=1, modality='kettlebell' WHERE id='kb_farmers_carry';
UPDATE exercises SET movement_pattern_id='mp_carry', matrix_level=2, modality='kettlebell' WHERE id='kb_suitcase_carry';
UPDATE exercises SET movement_pattern_id='mp_core', matrix_level=1, modality='calisthenics' WHERE id='support_hold';
UPDATE exercises SET movement_pattern_id='mp_core', matrix_level=1, modality='calisthenics' WHERE id='ring_support_hold';
UPDATE exercises SET movement_pattern_id='mp_core', matrix_level=1, modality='kettlebell' WHERE id='kb_halos';
UPDATE exercises SET movement_pattern_id='mp_core', matrix_level=2, modality='calisthenics' WHERE id='ring_knee_raises';
UPDATE exercises SET movement_pattern_id='mp_core', matrix_level=2, modality='calisthenics' WHERE id='parallette_l_sit';
UPDATE exercises SET movement_pattern_id='mp_core', matrix_level=3, modality='calisthenics' WHERE id='l_sit';
UPDATE exercises SET movement_pattern_id='mp_core', matrix_level=3, modality='calisthenics' WHERE id='ring_body_saw';
UPDATE exercises SET movement_pattern_id='mp_core', matrix_level=4, modality='calisthenics' WHERE id='ring_l_sit';
UPDATE exercises SET movement_pattern_id='mp_rehab', matrix_level=1, modality='band' WHERE id='banded_pull_aparts';
UPDATE exercises SET movement_pattern_id='mp_rehab', matrix_level=1, modality='band' WHERE id='banded_face_pulls';
UPDATE exercises SET movement_pattern_id='mp_rehab', matrix_level=1, modality='calisthenics' WHERE id='passive_dead_hangs';
UPDATE exercises SET movement_pattern_id='mp_rehab', matrix_level=2, modality='calisthenics' WHERE id='ring_face_pulls';
INSERT OR IGNORE INTO exercises (id, display_name, category, equipment, movement_pattern, session_types, bilateral, home_available, shoulder_safe, notes, movement_pattern_id, matrix_level, modality) VALUES
('incline_ring_pushup','Incline Ring Push-up','Push','Rings','push','Upper;Full Body A;Full Body B;Rings Only',1,0,1,'Rings at hip height. Reduces bodyweight load. Entry point for ring pressing.','mp_horiz_push',2,'calisthenics'),
('rto_ring_pushup','RTO Ring Push-up','Push','Rings','push','Upper;Rings Only',1,0,1,'Rings turned out 45-90 degrees at top. Massive chest and bicep demand.','mp_horiz_push',4,'calisthenics'),
('feet_elevated_ring_row','Feet-Elevated Ring Row','Pull','Rings','pull','Upper;Full Body A;Rings Only',1,0,1,'Feet on box/bench. Higher percentage of bodyweight than standard ring row.','mp_horiz_pull',3,'calisthenics'),
('archer_ring_row','Archer Ring Row','Pull','Rings','pull','Rings Only',0,0,1,'One arm pulls to chest, other locks out. True unilateral horizontal pull.','mp_horiz_pull',4,'calisthenics'),
('scapular_pullup','Scapular Pull-up','Pull+Rehab','Rings+BW','pull','Upper;Rehab;Rings Only',1,0,1,'Dead hang, engage shoulder blades only. No elbow bend. Foundation for pull-up shoulder health.','mp_vert_pull',1,'calisthenics'),
('ring_lsit_pullup','Ring L-Sit Pull-up','Pull+Core','Rings','pull','Rings Only',1,0,1,'Pull-up with legs locked straight at 90 degrees. Massive core demand.','mp_vert_pull',4,'calisthenics'),
('pike_pushup_elevated','Elevated Pike Push-up','Push','BW','push','Upper;Push Only',1,1,0,'Feet on box/bench. More vertical load over shoulders than floor pike. Monitor shoulder.','mp_vert_push',2,'calisthenics'),
('airborne_squat','Airborne Squat','Legs','BW','squat','Lower;Full Body B',0,1,1,'Single-leg squat, back knee grazes floor. No equipment. Bridge to pistol squat.','mp_anterior_squat',3,'calisthenics'),
('ring_assisted_pistol','Ring-Assisted Pistol Squat','Legs','Rings+BW','squat','Lower;Rings Only',0,0,1,'Full depth single-leg squat with light ring assistance for balance.','mp_anterior_squat',3,'calisthenics'),
('pistol_squat','Pistol Squat','Legs','BW','squat','Lower;Full Body B',0,1,1,'Unassisted full single-leg squat. Hold KB counterbalance if needed.','mp_anterior_squat',4,'calisthenics'),
('kb_snatch','KB Snatch','Hinge','KB','hinge','Full Body A;KB Only',0,1,0,'Bell from floor to overhead in one motion. Avoid with active shoulder impingement.','mp_posterior_hinge',4,'kettlebell'),
('kb_push_press','KB Push Press','Push','KB','push','Upper;Push Only',0,1,0,'Slight knee dip drives bell past shoulder sticking point. Avoid with impingement.','mp_overhead_press',2,'kettlebell'),
('kb_armor_complex','KB Armor Building Complex','Full Body','KB','hinge','Full Body A;KB Only',0,1,0,'2 cleans + 1 press + 3 squats without setting bells down. High-density hybrid.','mp_overhead_press',4,'kettlebell');
