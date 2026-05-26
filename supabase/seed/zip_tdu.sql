-- ZIP → TDU territory seed data
-- Covers all 5 deregulated territories + NON_DEREGULATED (municipal/co-op areas)
-- Source: PUCT ZIP code mapping (representative sample; full dataset ~1,800 rows)

-- Oncor territory (DFW + North/West Texas)
INSERT INTO zip_tdu (zip, tdu_territory, city, county) VALUES
('75001', 'oncor', 'Addison', 'Dallas'),
('75002', 'oncor', 'Allen', 'Collin'),
('75019', 'oncor', 'Coppell', 'Dallas'),
('75050', 'oncor', 'Grand Prairie', 'Dallas'),
('75201', 'oncor', 'Dallas', 'Dallas'),
('75202', 'oncor', 'Dallas', 'Dallas'),
('75203', 'oncor', 'Dallas', 'Dallas'),
('75204', 'oncor', 'Dallas', 'Dallas'),
('75205', 'oncor', 'Dallas', 'Dallas'),
('76001', 'oncor', 'Arlington', 'Tarrant'),
('76002', 'oncor', 'Arlington', 'Tarrant'),
('76010', 'oncor', 'Arlington', 'Tarrant'),
('76101', 'oncor', 'Fort Worth', 'Tarrant'),
('76102', 'oncor', 'Fort Worth', 'Tarrant'),
('76103', 'oncor', 'Fort Worth', 'Tarrant'),
-- CenterPoint territory (Houston area)
('77001', 'centerpoint', 'Houston', 'Harris'),
('77002', 'centerpoint', 'Houston', 'Harris'),
('77003', 'centerpoint', 'Houston', 'Harris'),
('77004', 'centerpoint', 'Houston', 'Harris'),
('77005', 'centerpoint', 'Houston', 'Harris'),
('77056', 'centerpoint', 'Houston', 'Harris'),
('77057', 'centerpoint', 'Houston', 'Harris'),
('77401', 'centerpoint', 'Bellaire', 'Harris'),
('77450', 'centerpoint', 'Katy', 'Harris'),
('77494', 'centerpoint', 'Katy', 'Fort Bend'),
-- AEP Central territory (Corpus Christi, San Angelo area)
('78401', 'aep_central', 'Corpus Christi', 'Nueces'),
('78402', 'aep_central', 'Corpus Christi', 'Nueces'),
('78403', 'aep_central', 'Corpus Christi', 'Nueces'),
('76901', 'aep_central', 'San Angelo', 'Tom Green'),
('76902', 'aep_central', 'San Angelo', 'Tom Green'),
-- AEP North territory (Abilene, Wichita Falls area)
('79601', 'aep_north', 'Abilene', 'Taylor'),
('79602', 'aep_north', 'Abilene', 'Taylor'),
('79603', 'aep_north', 'Abilene', 'Taylor'),
('76301', 'aep_north', 'Wichita Falls', 'Wichita'),
('76302', 'aep_north', 'Wichita Falls', 'Wichita'),
-- TNMP territory (parts of Lewisville, some Houston suburbs, parts of Galveston)
('75067', 'tnmp', 'Lewisville', 'Denton'),
('77510', 'tnmp', 'Santa Fe', 'Galveston'),
('77539', 'tnmp', 'Dickinson', 'Galveston'),
-- NON_DEREGULATED (Austin, San Antonio served by municipals/co-ops)
('78701', 'NON_DEREGULATED', 'Austin', 'Travis'),
('78702', 'NON_DEREGULATED', 'Austin', 'Travis'),
('78703', 'NON_DEREGULATED', 'Austin', 'Travis'),
('78201', 'NON_DEREGULATED', 'San Antonio', 'Bexar'),
('78202', 'NON_DEREGULATED', 'San Antonio', 'Bexar'),
('78203', 'NON_DEREGULATED', 'San Antonio', 'Bexar')
ON CONFLICT (zip) DO UPDATE SET
  tdu_territory = EXCLUDED.tdu_territory,
  city = EXCLUDED.city,
  county = EXCLUDED.county;
