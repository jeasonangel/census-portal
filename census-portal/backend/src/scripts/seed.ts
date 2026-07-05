import bcrypt from 'bcrypt';
import { config } from '../config';
import { generateApiKey, hashApiKey } from '../utils/apiKey';
import { query, pool } from '../db/pool';
// ============================================================
// 1. REGIONS (10 Regions of Cameroon)
// ============================================================
const REGIONS = [
  { code: 'AD', name: 'Adamaoua', population: 1200000, area_km2: 63701 },
  { code: 'CE', name: 'Centre', population: 4800000, area_km2: 68953 },
  { code: 'ES', name: 'East', population: 2300000, area_km2: 109002 },
  { code: 'FN', name: 'Far North', population: 1400000, area_km2: 34263 },
  { code: 'LT', name: 'Littoral', population: 3800000, area_km2: 20248 },
  { code: 'NO', name: 'North', population: 2900000, area_km2: 66090 },
  { code: 'NW', name: 'Northwest', population: 1800000, area_km2: 17300 },
  { code: 'WS', name: 'West', population: 3200000, area_km2: 13892 },
  { code: 'SW', name: 'Southwest', population: 1600000, area_km2: 25410 },
  { code: 'SO', name: 'South', population: 2500000, area_km2: 47191 },
];

// ============================================================
// 2. DEPARTMENTS (all 58 departments of Cameroon)
// ============================================================
const DEPARTMENTS: Array<{ code: string; name: string; region_code: string; population: number }> = [
  // Adamaoua (AD) - 5 departments
  { code: 'VN', name: 'Vina', region_code: 'AD', population: 525000 },
  { code: 'MBE', name: 'Mbéré', region_code: 'AD', population: 280000 },
  { code: 'DJR', name: 'Djérem', region_code: 'AD', population: 130000 },
  { code: 'FAD', name: 'Faro-et-Déo', region_code: 'AD', population: 90000 },
  { code: 'MBY', name: 'Mayo-Banyo', region_code: 'AD', population: 150000 },
  // Centre (CE) - 10 departments
  { code: 'MF', name: 'Mfoundi', region_code: 'CE', population: 1850000 },
  { code: 'LE', name: 'Lekié', region_code: 'CE', population: 354000 },
  { code: 'HSA', name: 'Haute-Sanaga', region_code: 'CE', population: 130000 },
  { code: 'MBI', name: 'Mbam-et-Inoubou', region_code: 'CE', population: 300000 },
  { code: 'MBK', name: 'Mbam-et-Kim', region_code: 'CE', population: 150000 },
  { code: 'MFA', name: 'Méfou-et-Afamba', region_code: 'CE', population: 250000 },
  { code: 'MFK', name: 'Méfou-et-Akono', region_code: 'CE', population: 120000 },
  { code: 'NYK', name: 'Nyong-et-Kéllé', region_code: 'CE', population: 150000 },
  { code: 'NYM', name: 'Nyong-et-Mfoumou', region_code: 'CE', population: 100000 },
  { code: 'NYS', name: "Nyong-et-So'o", region_code: 'CE', population: 200000 },
  // East (ES) - 4 departments
  { code: 'HA', name: 'Haut-Nyong', region_code: 'ES', population: 250000 },
  { code: 'KO', name: 'Kadey', region_code: 'ES', population: 340000 },
  { code: 'BNG', name: 'Boumba-et-Ngoko', region_code: 'ES', population: 150000 },
  { code: 'LOD', name: 'Lom-et-Djérem', region_code: 'ES', population: 280000 },
  // Far North (FN) - 6 departments
  { code: 'DI', name: 'Diamaré', region_code: 'FN', population: 250000 },
  { code: 'MK', name: 'Mayo-Kani', region_code: 'FN', population: 320000 },
  { code: 'LOC', name: 'Logone-et-Chari', region_code: 'FN', population: 350000 },
  { code: 'MDA', name: 'Mayo-Danay', region_code: 'FN', population: 450000 },
  { code: 'MSV', name: 'Mayo-Sava', region_code: 'FN', population: 300000 },
  { code: 'MTS', name: 'Mayo-Tsanaga', region_code: 'FN', population: 500000 },
  // Littoral (LT) - 4 departments
  { code: 'WO', name: 'Wouri', region_code: 'LT', population: 2900000 },
  { code: 'MO', name: 'Moungo', region_code: 'LT', population: 720000 },
  { code: 'NKA', name: 'Nkam', region_code: 'LT', population: 100000 },
  { code: 'SMA', name: 'Sanaga-Maritime', region_code: 'LT', population: 400000 },
  // North (NO) - 4 departments
  { code: 'BE', name: 'Bénoué', region_code: 'NO', population: 850000 },
  { code: 'ML', name: 'Mayo-Louti', region_code: 'NO', population: 410000 },
  { code: 'FAR', name: 'Faro', region_code: 'NO', population: 90000 },
  { code: 'MRE', name: 'Mayo-Rey', region_code: 'NO', population: 250000 },
  // Northwest (NW) - 7 departments
  { code: 'MEO', name: 'Mezam', region_code: 'NW', population: 450000 },
  { code: 'BU', name: 'Bui', region_code: 'NW', population: 330000 },
  { code: 'BOY', name: 'Boyo', region_code: 'NW', population: 200000 },
  { code: 'DOM', name: 'Donga-Mantung', region_code: 'NW', population: 250000 },
  { code: 'MEN', name: 'Menchum', region_code: 'NW', population: 180000 },
  { code: 'MOM', name: 'Momo', region_code: 'NW', population: 200000 },
  { code: 'NGK', name: 'Ngo-Ketunjia', region_code: 'NW', population: 150000 },
  // West (WS) - 8 departments
  { code: 'MI', name: 'Mifi', region_code: 'WS', population: 310000 },
  { code: 'ME', name: 'Ménoua', region_code: 'WS', population: 320000 },
  { code: 'BBT', name: 'Bamboutos', region_code: 'WS', population: 300000 },
  { code: 'HNK', name: 'Haut-Nkam', region_code: 'WS', population: 250000 },
  { code: 'HPL', name: 'Hauts-Plateaux', region_code: 'WS', population: 200000 },
  { code: 'KKH', name: 'Koung-Khi', region_code: 'WS', population: 150000 },
  { code: 'NDE', name: 'Ndé', region_code: 'WS', population: 180000 },
  { code: 'NOU', name: 'Noun', region_code: 'WS', population: 400000 },
  // Southwest (SW) - 6 departments
  { code: 'FA', name: 'Fako', region_code: 'SW', population: 480000 },
  { code: 'MA', name: 'Manyu', region_code: 'SW', population: 180000 },
  { code: 'KMA', name: 'Koupé-Manengouba', region_code: 'SW', population: 200000 },
  { code: 'LEB', name: 'Lebialem', region_code: 'SW', population: 100000 },
  { code: 'MEM', name: 'Meme', region_code: 'SW', population: 450000 },
  { code: 'NDI', name: 'Ndian', region_code: 'SW', population: 150000 },
  // South (SO) - 4 departments
  { code: 'MV', name: 'Mvila', region_code: 'SO', population: 350000 },
  { code: 'OC', name: 'Océan', region_code: 'SO', population: 330000 },
  { code: 'DJL', name: 'Dja-et-Lobo', region_code: 'SO', population: 200000 },
  { code: 'VDN', name: 'Vallée-du-Ntem', region_code: 'SO', population: 120000 },
];

// ============================================================
// 3. DISTRICTS (3 per department = 174 districts)
// ============================================================
const DISTRICTS: Array<{ code: string; name: string; dept_code: string }> = [
  // Vina (VN)
  { code: 'NG', name: 'Ngaoundéré 1er', dept_code: 'VN' },
  { code: 'NG2', name: 'Ngaoundéré 2e', dept_code: 'VN' },
  { code: 'NG3', name: 'Ngaoundéré 3e', dept_code: 'VN' },
  // Mbéré (MBE)
  { code: 'MEI', name: 'Meiganga', dept_code: 'MBE' },
  { code: 'DJO', name: 'Djohong', dept_code: 'MBE' },
  { code: 'NGU', name: 'Ngaoui', dept_code: 'MBE' },
  // Djérem (DJR)
  { code: 'TIB', name: 'Tibati', dept_code: 'DJR' },
  { code: 'NGD', name: 'Ngaoundal', dept_code: 'DJR' },
  { code: 'DEU', name: 'Deuk', dept_code: 'DJR' },
  // Faro-et-Déo (FAD)
  { code: 'TIG', name: 'Tignère', dept_code: 'FAD' },
  { code: 'GAL', name: 'Galim-Tignère', dept_code: 'FAD' },
  { code: 'KON', name: 'Kontcha', dept_code: 'FAD' },
  // Mayo-Banyo (MBY)
  { code: 'BAN', name: 'Banyo', dept_code: 'MBY' },
  { code: 'BKM', name: 'Bankim', dept_code: 'MBY' },
  { code: 'MDL', name: 'Mayo-Darlé', dept_code: 'MBY' },
  // Mfoundi (MF)
  { code: 'Y1', name: 'Yaoundé 1er', dept_code: 'MF' },
  { code: 'Y2', name: 'Yaoundé 2e', dept_code: 'MF' },
  { code: 'Y3', name: 'Yaoundé 3e', dept_code: 'MF' },
  // Lekié (LE)
  { code: 'MFOU', name: 'Mfou', dept_code: 'LE' },
  { code: 'MON', name: 'Monatélé', dept_code: 'LE' },
  { code: 'OBA', name: 'Obala', dept_code: 'LE' },
  // Haute-Sanaga (HSA)
  { code: 'NAE', name: 'Nanga-Eboko', dept_code: 'HSA' },
  { code: 'NKT', name: 'Nkoteng', dept_code: 'HSA' },
  { code: 'MTA', name: 'Minta', dept_code: 'HSA' },
  // Mbam-et-Inoubou (MBI)
  { code: 'BAI', name: 'Bafia', dept_code: 'MBI' },
  { code: 'BOK', name: 'Bokito', dept_code: 'MBI' },
  { code: 'OMB', name: 'Ombessa', dept_code: 'MBI' },
  // Mbam-et-Kim (MBK)
  { code: 'NTU', name: 'Ntui', dept_code: 'MBK' },
  { code: 'YOK', name: 'Yoko', dept_code: 'MBK' },
  { code: 'NGT', name: 'Ngambé-Tikar', dept_code: 'MBK' },
  // Méfou-et-Afamba (MFA)
  { code: 'AWA', name: 'Awaé', dept_code: 'MFA' },
  { code: 'ESS', name: 'Esse', dept_code: 'MFA' },
  { code: 'ANG', name: 'Angonkeng', dept_code: 'MFA' },
  // Méfou-et-Akono (MFK)
  { code: 'NGM', name: 'Ngoumou', dept_code: 'MFK' },
  { code: 'AKO', name: 'Akono', dept_code: 'MFK' },
  { code: 'BIK', name: 'Bikok', dept_code: 'MFK' },
  // Nyong-et-Kéllé (NYK)
  { code: 'ESE', name: 'Eséka', dept_code: 'NYK' },
  { code: 'BOT', name: 'Bot-Makak', dept_code: 'NYK' },
  { code: 'DIB', name: 'Dibang', dept_code: 'NYK' },
  // Nyong-et-Mfoumou (NYM)
  { code: 'AKN', name: 'Akonolinga', dept_code: 'NYM' },
  { code: 'AYO', name: 'Ayos', dept_code: 'NYM' },
  { code: 'END', name: 'Endom', dept_code: 'NYM' },
  // Nyong-et-So'o (NYS)
  { code: 'MBM', name: 'Mbalmayo', dept_code: 'NYS' },
  { code: 'NGZ', name: 'Ngomedzap', dept_code: 'NYS' },
  { code: 'MEG', name: 'Mengang', dept_code: 'NYS' },
  // Haut-Nyong (HA)
  { code: 'ABO', name: 'Abong-Mbang', dept_code: 'HA' },
  { code: 'DIM', name: 'Dimako', dept_code: 'HA' },
  { code: 'LOM', name: 'Lomié', dept_code: 'HA' },
  // Kadey (KO)
  { code: 'BAT', name: 'Batouri', dept_code: 'KO' },
  { code: 'KET', name: 'Kette', dept_code: 'KO' },
  { code: 'NDL', name: 'Ndelele', dept_code: 'KO' },
  // Boumba-et-Ngoko (BNG)
  { code: 'YKD', name: 'Yokadouma', dept_code: 'BNG' },
  { code: 'MOL', name: 'Moloundou', dept_code: 'BNG' },
  { code: 'SAL', name: 'Salapoumbé', dept_code: 'BNG' },
  // Lom-et-Djérem (LOD)
  { code: 'BT1', name: 'Bertoua 1er', dept_code: 'LOD' },
  { code: 'BT2', name: 'Bertoua 2e', dept_code: 'LOD' },
  { code: 'BEL', name: 'Belabo', dept_code: 'LOD' },
  // Diamaré (DI)
  { code: 'MAR', name: 'Maroua 1er', dept_code: 'DI' },
  { code: 'MAR2', name: 'Maroua 2e', dept_code: 'DI' },
  { code: 'MAR3', name: 'Maroua 3e', dept_code: 'DI' },
  // Mayo-Kani (MK)
  { code: 'KAE', name: 'Kaélé', dept_code: 'MK' },
  { code: 'MOU', name: 'Moulvoudaye', dept_code: 'MK' },
  { code: 'MIN', name: 'Mindif', dept_code: 'MK' },
  // Logone-et-Chari (LOC)
  { code: 'KOU', name: 'Kousséri', dept_code: 'LOC' },
  { code: 'MAK', name: 'Makary', dept_code: 'LOC' },
  { code: 'FOT', name: 'Fotokol', dept_code: 'LOC' },
  // Mayo-Danay (MDA)
  { code: 'YAG', name: 'Yagoua', dept_code: 'MDA' },
  { code: 'KAI', name: 'Kaï-Kaï', dept_code: 'MDA' },
  { code: 'MAG', name: 'Maga', dept_code: 'MDA' },
  // Mayo-Sava (MSV)
  { code: 'MOR', name: 'Mora', dept_code: 'MSV' },
  { code: 'KOL', name: 'Kolofata', dept_code: 'MSV' },
  { code: 'TOK', name: 'Tokombéré', dept_code: 'MSV' },
  // Mayo-Tsanaga (MTS)
  { code: 'MKL', name: 'Mokolo', dept_code: 'MTS' },
  { code: 'BOU', name: 'Bourha', dept_code: 'MTS' },
  { code: 'KOZ', name: 'Koza', dept_code: 'MTS' },
  // Wouri (WO)
  { code: 'D1', name: 'Douala 1er', dept_code: 'WO' },
  { code: 'D2', name: 'Douala 2e', dept_code: 'WO' },
  { code: 'D3', name: 'Douala 3e', dept_code: 'WO' },
  // Moungo (MO)
  { code: 'NKO', name: 'Nkongsamba', dept_code: 'MO' },
  { code: 'MBO', name: 'Mbanga', dept_code: 'MO' },
  { code: 'LOU', name: 'Loum', dept_code: 'MO' },
  // Nkam (NKA)
  { code: 'YAB', name: 'Yabassi', dept_code: 'NKA' },
  { code: 'NKJ', name: 'Nkondjock', dept_code: 'NKA' },
  { code: 'YIN', name: 'Yingui', dept_code: 'NKA' },
  // Sanaga-Maritime (SMA)
  { code: 'ED1', name: 'Édéa 1er', dept_code: 'SMA' },
  { code: 'ED2', name: 'Édéa 2e', dept_code: 'SMA' },
  { code: 'POU', name: 'Pouma', dept_code: 'SMA' },
  // Bénoué (BE)
  { code: 'GAR', name: 'Garoua 1er', dept_code: 'BE' },
  { code: 'GAR2', name: 'Garoua 2e', dept_code: 'BE' },
  { code: 'GAR3', name: 'Garoua 3e', dept_code: 'BE' },
  // Mayo-Louti (ML)
  { code: 'GUI', name: 'Guider', dept_code: 'ML' },
  { code: 'FIG', name: 'Figuil', dept_code: 'ML' },
  { code: 'MYO', name: 'Mayo-Oulo', dept_code: 'ML' },
  // Faro (FAR)
  { code: 'POL', name: 'Poli', dept_code: 'FAR' },
  { code: 'BEK', name: 'Béka', dept_code: 'FAR' },
  { code: 'SOR', name: 'Sorombéo', dept_code: 'FAR' },
  // Mayo-Rey (MRE)
  { code: 'TCH', name: 'Tcholliré', dept_code: 'MRE' },
  { code: 'REY', name: 'Rey-Bouba', dept_code: 'MRE' },
  { code: 'MDR', name: 'Madingring', dept_code: 'MRE' },
  // Mezam (MEO)
  { code: 'BAM', name: 'Bamenda 1er', dept_code: 'MEO' },
  { code: 'BAM2', name: 'Bamenda 2e', dept_code: 'MEO' },
  { code: 'BAM3', name: 'Bamenda 3e', dept_code: 'MEO' },
  // Bui (BU)
  { code: 'KUM', name: 'Kumbo', dept_code: 'BU' },
  { code: 'NGO', name: 'Ngo-Ketunjia', dept_code: 'BU' },
  { code: 'JAK', name: 'Jakiri', dept_code: 'BU' },
  // Boyo (BOY)
  { code: 'FUN', name: 'Fundong', dept_code: 'BOY' },
  { code: 'BLO', name: 'Belo', dept_code: 'BOY' },
  { code: 'NJI', name: 'Njinikom', dept_code: 'BOY' },
  // Donga-Mantung (DOM)
  { code: 'NKB', name: 'Nkambe', dept_code: 'DOM' },
  { code: 'NDU', name: 'Ndu', dept_code: 'DOM' },
  { code: 'MIS', name: 'Misaje', dept_code: 'DOM' },
  // Menchum (MEN)
  { code: 'WUM', name: 'Wum', dept_code: 'MEN' },
  { code: 'FUG', name: 'Fungom', dept_code: 'MEN' },
  { code: 'FRA', name: 'Furu-Awa', dept_code: 'MEN' },
  // Momo (MOM)
  { code: 'MBW', name: 'Mbengwi', dept_code: 'MOM' },
  { code: 'NJK', name: 'Njikwa', dept_code: 'MOM' },
  { code: 'WID', name: 'Widikum', dept_code: 'MOM' },
  // Ngo-Ketunjia (NGK)
  { code: 'NDP', name: 'Ndop', dept_code: 'NGK' },
  { code: 'BAB', name: 'Babessi', dept_code: 'NGK' },
  { code: 'BLK', name: 'Balikumbat', dept_code: 'NGK' },
  // Mifi (MI)
  { code: 'BAF', name: 'Bafoussam 1er', dept_code: 'MI' },
  { code: 'BAF2', name: 'Bafoussam 2e', dept_code: 'MI' },
  { code: 'BAF3', name: 'Bafoussam 3e', dept_code: 'MI' },
  // Ménoua (ME)
  { code: 'DLA', name: 'Dschang', dept_code: 'ME' },
  { code: 'SANT', name: 'Santchou', dept_code: 'ME' },
  { code: 'NKZ', name: 'Nkong-Zem', dept_code: 'ME' },
  // Bamboutos (BBT)
  { code: 'MBU', name: 'Mbouda', dept_code: 'BBT' },
  { code: 'BAJ', name: 'Babadjou', dept_code: 'BBT' },
  { code: 'GLM', name: 'Galim', dept_code: 'BBT' },
  // Haut-Nkam (HNK)
  { code: 'BFG', name: 'Bafang', dept_code: 'HNK' },
  { code: 'BNA', name: 'Bana', dept_code: 'HNK' },
  { code: 'BDJ', name: 'Bandja', dept_code: 'HNK' },
  // Hauts-Plateaux (HPL)
  { code: 'BHM', name: 'Baham', dept_code: 'HPL' },
  { code: 'BGO', name: 'Bangou', dept_code: 'HPL' },
  { code: 'BTE', name: 'Batié', dept_code: 'HPL' },
  // Koung-Khi (KKH)
  { code: 'BJN', name: 'Bandjoun', dept_code: 'KKH' },
  { code: 'BYG', name: 'Bayangam', dept_code: 'KKH' },
  { code: 'DJB', name: 'Djebem', dept_code: 'KKH' },
  // Ndé (NDE)
  { code: 'BGT', name: 'Bangangté', dept_code: 'NDE' },
  { code: 'BAZ', name: 'Bazou', dept_code: 'NDE' },
  { code: 'TON', name: 'Tonga', dept_code: 'NDE' },
  // Noun (NOU)
  { code: 'FMB', name: 'Foumban', dept_code: 'NOU' },
  { code: 'FBT', name: 'Foumbot', dept_code: 'NOU' },
  { code: 'MGB', name: 'Magba', dept_code: 'NOU' },
  // Fako (FA)
  { code: 'BUE', name: 'Buéa', dept_code: 'FA' },
  { code: 'LIM', name: 'Limbe', dept_code: 'FA' },
  { code: 'TIK', name: 'Tiko', dept_code: 'FA' },
  // Manyu (MA)
  { code: 'MAM', name: 'Mamfe', dept_code: 'MA' },
  { code: 'AKW', name: 'Akwaya', dept_code: 'MA' },
  { code: 'EYU', name: 'Eyumojock', dept_code: 'MA' },
  // Koupé-Manengouba (KMA)
  { code: 'BGM', name: 'Bangem', dept_code: 'KMA' },
  { code: 'TBL', name: 'Tombel', dept_code: 'KMA' },
  { code: 'NGI', name: 'Nguti', dept_code: 'KMA' },
  // Lebialem (LEB)
  { code: 'MEJ', name: 'Menji', dept_code: 'LEB' },
  { code: 'ALO', name: 'Alou', dept_code: 'LEB' },
  { code: 'FTM', name: 'Fontem', dept_code: 'LEB' },
  // Meme (MEM)
  { code: 'KB1', name: 'Kumba 1er', dept_code: 'MEM' },
  { code: 'KB2', name: 'Kumba 2e', dept_code: 'MEM' },
  { code: 'MBG', name: 'Mbonge', dept_code: 'MEM' },
  // Ndian (NDI)
  { code: 'MUN', name: 'Mundemba', dept_code: 'NDI' },
  { code: 'EKO', name: 'Ekondo-Titi', dept_code: 'NDI' },
  { code: 'ISA', name: 'Isangele', dept_code: 'NDI' },
  // Mvila (MV)
  { code: 'EBO', name: 'Ebolowa', dept_code: 'MV' },
  { code: 'SANG', name: 'Sangmélima', dept_code: 'MV' },
  { code: 'BIW', name: 'Biwong-Bulu', dept_code: 'MV' },
  // Océan (OC)
  { code: 'KRI', name: 'Kribi', dept_code: 'OC' },
  { code: 'LOL', name: 'Lolodorf', dept_code: 'OC' },
  { code: 'NIE', name: 'Niété', dept_code: 'OC' },
  // Dja-et-Lobo (DJL)
  { code: 'SGM', name: 'Sangmélima-DL', dept_code: 'DJL' },
  { code: 'DJM', name: 'Djoum', dept_code: 'DJL' },
  { code: 'MYS', name: 'Meyomessala', dept_code: 'DJL' },
  // Vallée-du-Ntem (VDN)
  { code: 'AMB', name: 'Ambam', dept_code: 'VDN' },
  { code: 'KYO', name: 'Kyé-Ossi', dept_code: 'VDN' },
  { code: 'OLZ', name: 'Olamzé', dept_code: 'VDN' },
];

// ============================================================
// 4. VILLAGES (2 per district = 80 villages)
// ============================================================
const VILLAGES: Array<{ code: string; name: string; district_code: string; population: number }> = [
  // Ngaoundéré 1er
  { code: 'V001', name: 'Dang', district_code: 'NG', population: 5234 },
  { code: 'V002', name: 'Ngaoundaye', district_code: 'NG', population: 4567 },
  // Ngaoundéré 2e
  { code: 'V003', name: 'Mbakaou', district_code: 'NG2', population: 6789 },
  { code: 'V004', name: 'Tchabal', district_code: 'NG2', population: 2345 },
  // Meiganga
  { code: 'V005', name: 'Boula', district_code: 'MEI', population: 3456 },
  { code: 'V006', name: 'Koyo', district_code: 'MEI', population: 2345 },
  // Djohong
  { code: 'V007', name: 'Djohong-Centre', district_code: 'DJO', population: 4567 },
  { code: 'V008', name: 'Beka', district_code: 'DJO', population: 3456 },
  // Yaoundé 1er
  { code: 'V009', name: 'Mvog-Mbi', district_code: 'Y1', population: 85000 },
  { code: 'V010', name: 'Mvog-Meli', district_code: 'Y1', population: 72000 },
  // Yaoundé 2e
  { code: 'V011', name: 'Mokolo', district_code: 'Y2', population: 95000 },
  { code: 'V012', name: 'Messa', district_code: 'Y2', population: 88000 },
  // Mfou
  { code: 'V013', name: 'Nkolafamba', district_code: 'MFOU', population: 5678 },
  { code: 'V014', name: 'Nkolfoulou', district_code: 'MFOU', population: 4567 },
  // Monatélé
  { code: 'V015', name: 'Monatélé-Centre', district_code: 'MON', population: 6789 },
  { code: 'V016', name: 'Nkometou', district_code: 'MON', population: 3456 },
  // Abong-Mbang
  { code: 'V017', name: 'Abong-Mbang Centre', district_code: 'ABO', population: 8901 },
  { code: 'V018', name: 'Ngatto', district_code: 'ABO', population: 4567 },
  // Dimako
  { code: 'V019', name: 'Dimako Centre', district_code: 'DIM', population: 5678 },
  { code: 'V020', name: 'Mindourou', district_code: 'DIM', population: 3456 },
  // Batouri
  { code: 'V021', name: 'Batouri Centre', district_code: 'BAT', population: 7890 },
  { code: 'V022', name: 'Nguelebok', district_code: 'BAT', population: 4567 },
  // Kette
  { code: 'V023', name: 'Kette Centre', district_code: 'KET', population: 3456 },
  { code: 'V024', name: 'Ngoko', district_code: 'KET', population: 2345 },
  // Maroua 1er
  { code: 'V025', name: 'Bamendjé', district_code: 'MAR', population: 45678 },
  { code: 'V026', name: 'Lopéré', district_code: 'MAR', population: 34567 },
  // Maroua 2e
  { code: 'V027', name: 'Roumde-Adja', district_code: 'MAR2', population: 45678 },
  { code: 'V028', name: 'Poumpoumré', district_code: 'MAR2', population: 34567 },
  // Kaélé
  { code: 'V029', name: 'Kaélé Centre', district_code: 'KAE', population: 23456 },
  { code: 'V030', name: 'Touloum', district_code: 'KAE', population: 12345 },
  // Moulvoudaye
  { code: 'V031', name: 'Moulvoudaye Centre', district_code: 'MOU', population: 12345 },
  { code: 'V032', name: 'Moutourwa', district_code: 'MOU', population: 8901 },
  // Douala 1er
  { code: 'V033', name: 'Bonanjo', district_code: 'D1', population: 45000 },
  { code: 'V034', name: 'Bali', district_code: 'D1', population: 78000 },
  // Douala 2e
  { code: 'V035', name: 'Logbessou', district_code: 'D2', population: 95000 },
  { code: 'V036', name: 'Yassa', district_code: 'D2', population: 82000 },
  // Nkongsamba
  { code: 'V037', name: 'Nkongsamba Centre', district_code: 'NKO', population: 45678 },
  { code: 'V038', name: 'Baré', district_code: 'NKO', population: 23456 },
  // Mbanga
  { code: 'V039', name: 'Mbanga Centre', district_code: 'MBO', population: 23456 },
  { code: 'V040', name: 'Nkondjock', district_code: 'MBO', population: 12345 },
  // Garoua 1er
  { code: 'V041', name: 'Bamendjé', district_code: 'GAR', population: 23456 },
  { code: 'V042', name: 'Lopéré', district_code: 'GAR', population: 34567 },
  // Garoua 2e
  { code: 'V043', name: 'Roumde-Adja', district_code: 'GAR2', population: 34567 },
  { code: 'V044', name: 'Poumpoumré', district_code: 'GAR2', population: 23456 },
  // Guider
  { code: 'V045', name: 'Guider Centre', district_code: 'GUI', population: 23456 },
  { code: 'V046', name: 'Douroum', district_code: 'GUI', population: 12345 },
  // Figuil
  { code: 'V047', name: 'Figuil Centre', district_code: 'FIG', population: 12345 },
  { code: 'V048', name: 'Gashiga', district_code: 'FIG', population: 8901 },
  // Bamenda 1er
  { code: 'V049', name: 'Ntarinkon', district_code: 'BAM', population: 45678 },
  { code: 'V050', name: 'Bambili', district_code: 'BAM', population: 34567 },
  // Bamenda 2e
  { code: 'V051', name: 'Mbengwi', district_code: 'BAM2', population: 34567 },
  { code: 'V052', name: 'Tadji', district_code: 'BAM2', population: 23456 },
  // Kumbo
  { code: 'V053', name: 'Kumbo Centre', district_code: 'KUM', population: 34567 },
  { code: 'V054', name: 'Tobin', district_code: 'KUM', population: 23456 },
  // Ngo-Ketunjia
  { code: 'V055', name: 'Bafut', district_code: 'NGO', population: 23456 },
  { code: 'V056', name: 'Mbatu', district_code: 'NGO', population: 12345 },
  // Bafoussam 1er
  { code: 'V057', name: 'Domayo', district_code: 'BAF', population: 45678 },
  { code: 'V058', name: 'Ndiandam', district_code: 'BAF', population: 34567 },
  // Bafoussam 2e
  { code: 'V059', name: 'Tchitchoua', district_code: 'BAF2', population: 34567 },
  { code: 'V060', name: 'Banengo', district_code: 'BAF2', population: 23456 },
  // Dschang
  { code: 'V061', name: 'Dschang Centre', district_code: 'DLA', population: 34567 },
  { code: 'V062', name: 'Fokoue', district_code: 'DLA', population: 23456 },
  // Santchou
  { code: 'V063', name: 'Santchou Centre', district_code: 'SANT', population: 23456 },
  { code: 'V064', name: 'Nkong', district_code: 'SANT', population: 12345 },
  // Buéa
  { code: 'V065', name: 'Buéa Centre', district_code: 'BUE', population: 45678 },
  { code: 'V066', name: 'Muea', district_code: 'BUE', population: 23456 },
  // Limbe
  { code: 'V067', name: 'Limbe Centre', district_code: 'LIM', population: 34567 },
  { code: 'V068', name: 'Idenau', district_code: 'LIM', population: 23456 },
  // Mamfe
  { code: 'V069', name: 'Mamfe Centre', district_code: 'MAM', population: 23456 },
  { code: 'V070', name: 'Akwaya', district_code: 'MAM', population: 12345 },
  // Akwaya
  { code: 'V071', name: 'Akwaya Centre', district_code: 'AKW', population: 12345 },
  { code: 'V072', name: 'Bakossi', district_code: 'AKW', population: 8901 },
  // Ebolowa
  { code: 'V073', name: 'Ebolowa Centre', district_code: 'EBO', population: 45678 },
  { code: 'V074', name: 'Meyomessala', district_code: 'EBO', population: 23456 },
  // Sangmélima
  { code: 'V075', name: 'Sangmélima Centre', district_code: 'SANG', population: 23456 },
  { code: 'V076', name: 'Zoétélé', district_code: 'SANG', population: 12345 },
  // Kribi
  { code: 'V077', name: 'Kribi Centre', district_code: 'KRI', population: 34567 },
  { code: 'V078', name: 'Mpalla', district_code: 'KRI', population: 23456 },
  // Lolodorf
  { code: 'V079', name: 'Lolodorf Centre', district_code: 'LOL', population: 12345 },
  { code: 'V080', name: 'Bipindi', district_code: 'LOL', population: 8901 },
];

// ============================================================
// 5. INDICATORS (10 indicators)
// ============================================================
const INDICATORS = [
  { code: 'POP_TOT', name: 'Total Population', unit: 'people', category: 'Demography' },
  { code: 'POP_MALE', name: 'Male Population', unit: 'people', category: 'Demography' },
  { code: 'POP_FEMALE', name: 'Female Population', unit: 'people', category: 'Demography' },
  { code: 'POP_URBAN', name: 'Urban Population', unit: 'people', category: 'Demography' },
  { code: 'POP_RURAL', name: 'Rural Population', unit: 'people', category: 'Demography' },
  { code: 'LIT_RATE', name: 'Literacy Rate', unit: '%', category: 'Education' },
  { code: 'SCHOOL_ENROLL', name: 'School Enrollment', unit: '%', category: 'Education' },
  { code: 'WATER_ACCESS', name: 'Access to Clean Water', unit: '%', category: 'Housing' },
  { code: 'ELECTRICITY_ACCESS', name: 'Access to Electricity', unit: '%', category: 'Housing' },
  { code: 'EMPLOYMENT', name: 'Employment Rate', unit: '%', category: 'Economy' },
];

// ============================================================
// 6. DATA VALUES - Complete data for all levels
// ============================================================

// Region-level data
const REGION_DATA: Record<string, Record<string, number>> = {
  AD: { POP_TOT: 1200000, POP_MALE: 600000, POP_FEMALE: 600000, POP_URBAN: 360000, POP_RURAL: 840000, LIT_RATE: 55.0, SCHOOL_ENROLL: 70.0, WATER_ACCESS: 48.0, ELECTRICITY_ACCESS: 25.0, EMPLOYMENT: 60.0 },
  CE: { POP_TOT: 4800000, POP_MALE: 2400000, POP_FEMALE: 2400000, POP_URBAN: 3200000, POP_RURAL: 1600000, LIT_RATE: 85.2, SCHOOL_ENROLL: 92.5, WATER_ACCESS: 71.4, ELECTRICITY_ACCESS: 65.2, EMPLOYMENT: 68.5 },
  ES: { POP_TOT: 2300000, POP_MALE: 1150000, POP_FEMALE: 1150000, POP_URBAN: 460000, POP_RURAL: 1840000, LIT_RATE: 68.5, SCHOOL_ENROLL: 78.0, WATER_ACCESS: 50.3, ELECTRICITY_ACCESS: 28.0, EMPLOYMENT: 61.2 },
  FN: { POP_TOT: 1400000, POP_MALE: 700000, POP_FEMALE: 700000, POP_URBAN: 280000, POP_RURAL: 1120000, LIT_RATE: 48.1, SCHOOL_ENROLL: 65.0, WATER_ACCESS: 38.5, ELECTRICITY_ACCESS: 18.0, EMPLOYMENT: 55.0 },
  LT: { POP_TOT: 3800000, POP_MALE: 1900000, POP_FEMALE: 1900000, POP_URBAN: 2850000, POP_RURAL: 950000, LIT_RATE: 88.7, SCHOOL_ENROLL: 94.2, WATER_ACCESS: 77.8, ELECTRICITY_ACCESS: 72.5, EMPLOYMENT: 72.3 },
  NO: { POP_TOT: 2900000, POP_MALE: 1450000, POP_FEMALE: 1450000, POP_URBAN: 580000, POP_RURAL: 2320000, LIT_RATE: 62.4, SCHOOL_ENROLL: 76.5, WATER_ACCESS: 42.3, ELECTRICITY_ACCESS: 25.5, EMPLOYMENT: 58.2 },
  NW: { POP_TOT: 1800000, POP_MALE: 900000, POP_FEMALE: 900000, POP_URBAN: 540000, POP_RURAL: 1260000, LIT_RATE: 80.0, SCHOOL_ENROLL: 86.0, WATER_ACCESS: 60.0, ELECTRICITY_ACCESS: 42.5, EMPLOYMENT: 64.0 },
  WS: { POP_TOT: 3200000, POP_MALE: 1600000, POP_FEMALE: 1600000, POP_URBAN: 960000, POP_RURAL: 2240000, LIT_RATE: 78.4, SCHOOL_ENROLL: 88.5, WATER_ACCESS: 65.2, ELECTRICITY_ACCESS: 48.5, EMPLOYMENT: 65.8 },
  SW: { POP_TOT: 1600000, POP_MALE: 800000, POP_FEMALE: 800000, POP_URBAN: 480000, POP_RURAL: 1120000, LIT_RATE: 82.5, SCHOOL_ENROLL: 89.0, WATER_ACCESS: 68.0, ELECTRICITY_ACCESS: 52.5, EMPLOYMENT: 66.5 },
  SO: { POP_TOT: 2500000, POP_MALE: 1250000, POP_FEMALE: 1250000, POP_URBAN: 500000, POP_RURAL: 2000000, LIT_RATE: 81.0, SCHOOL_ENROLL: 87.5, WATER_ACCESS: 66.5, ELECTRICITY_ACCESS: 35.5, EMPLOYMENT: 65.0 },
};

// Department-level data (2 departments per region - sample data)
const DEPT_DATA: Record<string, Record<string, number>> = {
  VN: { POP_TOT: 525000, POP_MALE: 262500, POP_FEMALE: 262500, POP_URBAN: 157500, POP_RURAL: 367500, LIT_RATE: 58.0, SCHOOL_ENROLL: 72.0, WATER_ACCESS: 50.0, ELECTRICITY_ACCESS: 28.0, EMPLOYMENT: 62.0 },
  MBE: { POP_TOT: 280000, POP_MALE: 140000, POP_FEMALE: 140000, POP_URBAN: 84000, POP_RURAL: 196000, LIT_RATE: 52.0, SCHOOL_ENROLL: 68.0, WATER_ACCESS: 45.0, ELECTRICITY_ACCESS: 22.0, EMPLOYMENT: 58.0 },
  MF: { POP_TOT: 1850000, POP_MALE: 925000, POP_FEMALE: 925000, POP_URBAN: 1665000, POP_RURAL: 185000, LIT_RATE: 90.0, SCHOOL_ENROLL: 95.0, WATER_ACCESS: 80.0, ELECTRICITY_ACCESS: 75.0, EMPLOYMENT: 72.0 },
  LE: { POP_TOT: 354000, POP_MALE: 177000, POP_FEMALE: 177000, POP_URBAN: 106200, POP_RURAL: 247800, LIT_RATE: 75.0, SCHOOL_ENROLL: 85.0, WATER_ACCESS: 65.0, ELECTRICITY_ACCESS: 55.0, EMPLOYMENT: 65.0 },
  HA: { POP_TOT: 250000, POP_MALE: 125000, POP_FEMALE: 125000, POP_URBAN: 75000, POP_RURAL: 175000, LIT_RATE: 65.0, SCHOOL_ENROLL: 75.0, WATER_ACCESS: 48.0, ELECTRICITY_ACCESS: 25.0, EMPLOYMENT: 60.0 },
  KO: { POP_TOT: 340000, POP_MALE: 170000, POP_FEMALE: 170000, POP_URBAN: 102000, POP_RURAL: 238000, LIT_RATE: 62.0, SCHOOL_ENROLL: 72.0, WATER_ACCESS: 45.0, ELECTRICITY_ACCESS: 22.0, EMPLOYMENT: 58.0 },
  DI: { POP_TOT: 250000, POP_MALE: 125000, POP_FEMALE: 125000, POP_URBAN: 75000, POP_RURAL: 175000, LIT_RATE: 48.0, SCHOOL_ENROLL: 65.0, WATER_ACCESS: 38.0, ELECTRICITY_ACCESS: 18.0, EMPLOYMENT: 55.0 },
  MK: { POP_TOT: 320000, POP_MALE: 160000, POP_FEMALE: 160000, POP_URBAN: 96000, POP_RURAL: 224000, LIT_RATE: 45.0, SCHOOL_ENROLL: 62.0, WATER_ACCESS: 35.0, ELECTRICITY_ACCESS: 16.0, EMPLOYMENT: 52.0 },
  WO: { POP_TOT: 2900000, POP_MALE: 1450000, POP_FEMALE: 1450000, POP_URBAN: 2610000, POP_RURAL: 290000, LIT_RATE: 92.0, SCHOOL_ENROLL: 96.0, WATER_ACCESS: 85.0, ELECTRICITY_ACCESS: 80.0, EMPLOYMENT: 75.0 },
  MO: { POP_TOT: 720000, POP_MALE: 360000, POP_FEMALE: 360000, POP_URBAN: 216000, POP_RURAL: 504000, LIT_RATE: 82.0, SCHOOL_ENROLL: 90.0, WATER_ACCESS: 72.0, ELECTRICITY_ACCESS: 65.0, EMPLOYMENT: 70.0 },
  BE: { POP_TOT: 850000, POP_MALE: 425000, POP_FEMALE: 425000, POP_URBAN: 255000, POP_RURAL: 595000, LIT_RATE: 60.0, SCHOOL_ENROLL: 75.0, WATER_ACCESS: 42.0, ELECTRICITY_ACCESS: 25.0, EMPLOYMENT: 58.0 },
  ML: { POP_TOT: 410000, POP_MALE: 205000, POP_FEMALE: 205000, POP_URBAN: 123000, POP_RURAL: 287000, LIT_RATE: 55.0, SCHOOL_ENROLL: 70.0, WATER_ACCESS: 38.0, ELECTRICITY_ACCESS: 20.0, EMPLOYMENT: 55.0 },
  MEO: { POP_TOT: 450000, POP_MALE: 225000, POP_FEMALE: 225000, POP_URBAN: 135000, POP_RURAL: 315000, LIT_RATE: 85.0, SCHOOL_ENROLL: 90.0, WATER_ACCESS: 65.0, ELECTRICITY_ACCESS: 48.0, EMPLOYMENT: 68.0 },
  BU: { POP_TOT: 330000, POP_MALE: 165000, POP_FEMALE: 165000, POP_URBAN: 99000, POP_RURAL: 231000, LIT_RATE: 78.0, SCHOOL_ENROLL: 85.0, WATER_ACCESS: 58.0, ELECTRICITY_ACCESS: 40.0, EMPLOYMENT: 62.0 },
  MI: { POP_TOT: 310000, POP_MALE: 155000, POP_FEMALE: 155000, POP_URBAN: 93000, POP_RURAL: 217000, LIT_RATE: 80.0, SCHOOL_ENROLL: 90.0, WATER_ACCESS: 68.0, ELECTRICITY_ACCESS: 50.0, EMPLOYMENT: 68.0 },
  ME: { POP_TOT: 320000, POP_MALE: 160000, POP_FEMALE: 160000, POP_URBAN: 96000, POP_RURAL: 224000, LIT_RATE: 82.0, SCHOOL_ENROLL: 92.0, WATER_ACCESS: 70.0, ELECTRICITY_ACCESS: 52.0, EMPLOYMENT: 65.0 },
  FA: { POP_TOT: 480000, POP_MALE: 240000, POP_FEMALE: 240000, POP_URBAN: 144000, POP_RURAL: 336000, LIT_RATE: 85.0, SCHOOL_ENROLL: 92.0, WATER_ACCESS: 72.0, ELECTRICITY_ACCESS: 55.0, EMPLOYMENT: 70.0 },
  MA: { POP_TOT: 180000, POP_MALE: 90000, POP_FEMALE: 90000, POP_URBAN: 54000, POP_RURAL: 126000, LIT_RATE: 78.0, SCHOOL_ENROLL: 85.0, WATER_ACCESS: 62.0, ELECTRICITY_ACCESS: 45.0, EMPLOYMENT: 62.0 },
  MV: { POP_TOT: 350000, POP_MALE: 175000, POP_FEMALE: 175000, POP_URBAN: 105000, POP_RURAL: 245000, LIT_RATE: 80.0, SCHOOL_ENROLL: 88.0, WATER_ACCESS: 68.0, ELECTRICITY_ACCESS: 35.0, EMPLOYMENT: 65.0 },
  OC: { POP_TOT: 330000, POP_MALE: 165000, POP_FEMALE: 165000, POP_URBAN: 99000, POP_RURAL: 231000, LIT_RATE: 78.0, SCHOOL_ENROLL: 85.0, WATER_ACCESS: 65.0, ELECTRICITY_ACCESS: 32.0, EMPLOYMENT: 62.0 },
};

// District-level data (sample for first 10 districts)
const DIST_DATA: Record<string, Record<string, number>> = {
  NG: { POP_TOT: 152698, POP_MALE: 76349, POP_FEMALE: 76349, POP_URBAN: 106889, POP_RURAL: 45809, LIT_RATE: 72.3, SCHOOL_ENROLL: 85.0, WATER_ACCESS: 65.0, ELECTRICITY_ACCESS: 55.0, EMPLOYMENT: 68.0 },
  NG2: { POP_TOT: 98456, POP_MALE: 49228, POP_FEMALE: 49228, POP_URBAN: 68919, POP_RURAL: 29537, LIT_RATE: 68.5, SCHOOL_ENROLL: 80.0, WATER_ACCESS: 60.0, ELECTRICITY_ACCESS: 48.0, EMPLOYMENT: 65.0 },
  MEI: { POP_TOT: 45678, POP_MALE: 22839, POP_FEMALE: 22839, POP_URBAN: 13703, POP_RURAL: 31975, LIT_RATE: 42.1, SCHOOL_ENROLL: 65.0, WATER_ACCESS: 35.0, ELECTRICITY_ACCESS: 20.0, EMPLOYMENT: 55.0 },
  DJO: { POP_TOT: 23456, POP_MALE: 11728, POP_FEMALE: 11728, POP_URBAN: 7037, POP_RURAL: 16419, LIT_RATE: 38.7, SCHOOL_ENROLL: 60.0, WATER_ACCESS: 30.0, ELECTRICITY_ACCESS: 18.0, EMPLOYMENT: 50.0 },
  Y1: { POP_TOT: 620000, POP_MALE: 310000, POP_FEMALE: 310000, POP_URBAN: 558000, POP_RURAL: 62000, LIT_RATE: 91.2, SCHOOL_ENROLL: 96.0, WATER_ACCESS: 85.0, ELECTRICITY_ACCESS: 80.0, EMPLOYMENT: 75.0 },
  Y2: { POP_TOT: 520000, POP_MALE: 260000, POP_FEMALE: 260000, POP_URBAN: 468000, POP_RURAL: 52000, LIT_RATE: 89.5, SCHOOL_ENROLL: 95.0, WATER_ACCESS: 82.0, ELECTRICITY_ACCESS: 78.0, EMPLOYMENT: 73.0 },
  MFOU: { POP_TOT: 45678, POP_MALE: 22839, POP_FEMALE: 22839, POP_URBAN: 13703, POP_RURAL: 31975, LIT_RATE: 65.4, SCHOOL_ENROLL: 78.0, WATER_ACCESS: 55.0, ELECTRICITY_ACCESS: 45.0, EMPLOYMENT: 62.0 },
  MON: { POP_TOT: 6789, POP_MALE: 3394, POP_FEMALE: 3394, POP_URBAN: 2037, POP_RURAL: 4752, LIT_RATE: 58.9, SCHOOL_ENROLL: 72.0, WATER_ACCESS: 48.0, ELECTRICITY_ACCESS: 38.0, EMPLOYMENT: 58.0 },
  ABO: { POP_TOT: 8901, POP_MALE: 4450, POP_FEMALE: 4450, POP_URBAN: 2670, POP_RURAL: 6231, LIT_RATE: 62.0, SCHOOL_ENROLL: 75.0, WATER_ACCESS: 45.0, ELECTRICITY_ACCESS: 25.0, EMPLOYMENT: 58.0 },
  DIM: { POP_TOT: 5678, POP_MALE: 2839, POP_FEMALE: 2839, POP_URBAN: 1703, POP_RURAL: 3975, LIT_RATE: 58.0, SCHOOL_ENROLL: 70.0, WATER_ACCESS: 42.0, ELECTRICITY_ACCESS: 22.0, EMPLOYMENT: 55.0 },
};

// Village-level data (sample for first 10 villages)
const VILLAGE_DATA: Record<string, Record<string, number>> = {
  'Dang': { POP_TOT: 5234, POP_MALE: 2617, POP_FEMALE: 2617, POP_URBAN: 0, POP_RURAL: 5234, LIT_RATE: 28.5, SCHOOL_ENROLL: 45.0, WATER_ACCESS: 15.0, ELECTRICITY_ACCESS: 8.0, EMPLOYMENT: 40.0 },
  'Ngaoundaye': { POP_TOT: 4567, POP_MALE: 2283, POP_FEMALE: 2283, POP_URBAN: 0, POP_RURAL: 4567, LIT_RATE: 31.2, SCHOOL_ENROLL: 48.0, WATER_ACCESS: 18.0, ELECTRICITY_ACCESS: 10.0, EMPLOYMENT: 42.0 },
  'Mbakaou': { POP_TOT: 6789, POP_MALE: 3394, POP_FEMALE: 3394, POP_URBAN: 0, POP_RURAL: 6789, LIT_RATE: 25.8, SCHOOL_ENROLL: 42.0, WATER_ACCESS: 12.0, ELECTRICITY_ACCESS: 6.0, EMPLOYMENT: 38.0 },
  'Tchabal': { POP_TOT: 2345, POP_MALE: 1172, POP_FEMALE: 1172, POP_URBAN: 0, POP_RURAL: 2345, LIT_RATE: 22.0, SCHOOL_ENROLL: 38.0, WATER_ACCESS: 10.0, ELECTRICITY_ACCESS: 5.0, EMPLOYMENT: 35.0 },
  'Boula': { POP_TOT: 3456, POP_MALE: 1728, POP_FEMALE: 1728, POP_URBAN: 0, POP_RURAL: 3456, LIT_RATE: 35.0, SCHOOL_ENROLL: 55.0, WATER_ACCESS: 20.0, ELECTRICITY_ACCESS: 12.0, EMPLOYMENT: 48.0 },
  'Koyo': { POP_TOT: 2345, POP_MALE: 1172, POP_FEMALE: 1172, POP_URBAN: 0, POP_RURAL: 2345, LIT_RATE: 32.0, SCHOOL_ENROLL: 50.0, WATER_ACCESS: 18.0, ELECTRICITY_ACCESS: 10.0, EMPLOYMENT: 45.0 },
  'Djohong-Centre': { POP_TOT: 4567, POP_MALE: 2283, POP_FEMALE: 2283, POP_URBAN: 0, POP_RURAL: 4567, LIT_RATE: 38.7, SCHOOL_ENROLL: 60.0, WATER_ACCESS: 30.0, ELECTRICITY_ACCESS: 18.0, EMPLOYMENT: 50.0 },
  'Beka': { POP_TOT: 3456, POP_MALE: 1728, POP_FEMALE: 1728, POP_URBAN: 0, POP_RURAL: 3456, LIT_RATE: 35.0, SCHOOL_ENROLL: 55.0, WATER_ACCESS: 25.0, ELECTRICITY_ACCESS: 15.0, EMPLOYMENT: 48.0 },
  'Mvog-Mbi': { POP_TOT: 85000, POP_MALE: 42500, POP_FEMALE: 42500, POP_URBAN: 85000, POP_RURAL: 0, LIT_RATE: 88.2, SCHOOL_ENROLL: 95.0, WATER_ACCESS: 82.0, ELECTRICITY_ACCESS: 78.0, EMPLOYMENT: 72.0 },
  'Mvog-Meli': { POP_TOT: 72000, POP_MALE: 36000, POP_FEMALE: 36000, POP_URBAN: 72000, POP_RURAL: 0, LIT_RATE: 85.7, SCHOOL_ENROLL: 93.0, WATER_ACCESS: 80.0, ELECTRICITY_ACCESS: 76.0, EMPLOYMENT: 70.0 },
};

// ============================================================
// 6b. DERIVED DATA - fills in every department/district that
// doesn't have explicit figures above. Cameroon's next official
// census has not been published, so these are realistic
// estimates scaled from each region's baseline (REGION_DATA) by
// population share, following the same urban/rural and
// access-indicator pattern as the hand-set entries — not
// verified administrative statistics.
// ============================================================

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function deriveIndicators(
  population: number,
  baseline: Record<string, number>,
  weight: number
): Record<string, number> {
  const urbanRatio = baseline.POP_URBAN / baseline.POP_TOT;
  const accessWeight = 0.5 + 0.5 * weight;
  const popUrbanRatio = clamp(urbanRatio * weight, 0.03, 0.96);
  const popUrban = Math.round(population * popUrbanRatio);
  const popMale = Math.round(population / 2);
  return {
    POP_TOT: population,
    POP_MALE: popMale,
    POP_FEMALE: population - popMale,
    POP_URBAN: popUrban,
    POP_RURAL: population - popUrban,
    LIT_RATE: round1(clamp(baseline.LIT_RATE * accessWeight, 15, 97)),
    SCHOOL_ENROLL: round1(clamp(baseline.SCHOOL_ENROLL * accessWeight, 20, 98)),
    WATER_ACCESS: round1(clamp(baseline.WATER_ACCESS * accessWeight, 5, 95)),
    ELECTRICITY_ACCESS: round1(clamp(baseline.ELECTRICITY_ACCESS * accessWeight, 2, 92)),
    EMPLOYMENT: round1(clamp(baseline.EMPLOYMENT * accessWeight, 30, 85)),
  };
}

// --- Fill in missing department data (weighted by population rank within region) ---
for (const region of REGIONS) {
  const deptsInRegion = DEPARTMENTS.filter(d => d.region_code === region.code);
  const pops = deptsInRegion.map(d => d.population);
  const maxPop = Math.max(...pops);
  const minPop = Math.min(...pops);
  for (const dept of deptsInRegion) {
    if (DEPT_DATA[dept.code]) continue;
    const norm = maxPop === minPop ? 1 : (dept.population - minPop) / (maxPop - minPop);
    const weight = 0.55 + norm * 0.65; // 0.55 (smallest dept) - 1.20 (largest dept)
    DEPT_DATA[dept.code] = deriveIndicators(dept.population, REGION_DATA[region.code], weight);
  }
}

// --- Fill in missing district data (weighted by position within department) ---
for (const dept of DEPARTMENTS) {
  const distsInDept = DISTRICTS.filter(d => d.dept_code === dept.code);
  const missing = distsInDept.filter(d => !DIST_DATA[d.code]);
  if (missing.length === 0) continue;

  const known = distsInDept.filter(d => DIST_DATA[d.code]);
  const knownPopSum = known.reduce((sum, d) => sum + (DIST_DATA[d.code]?.POP_TOT || 0), 0);
  const remainingPop = Math.max(dept.population - knownPopSum, missing.length * 1000);

  const shareWeights = missing.map(d => distsInDept.length - distsInDept.indexOf(d));
  const shareTotal = shareWeights.reduce((a, b) => a + b, 0);

  missing.forEach((district, i) => {
    const pos = distsInDept.indexOf(district);
    const share = shareWeights[i] / shareTotal;
    const districtPop = Math.max(1000, Math.round(remainingPop * share));
    // earlier-listed districts are the department's chief town / larger urban centre
    const posWeight = pos === 0 ? 1.15 : pos === 1 ? 0.95 : 0.75;
    DIST_DATA[district.code] = deriveIndicators(districtPop, DEPT_DATA[dept.code], posWeight);
  });
}

// ============================================================
// MAIN SEED FUNCTION
// ============================================================

async function seed() {
  console.log('🌍 Seeding Cameroon Census Data...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    // --- 1. Insert Regions ---
    console.log('\n🗺️ Seeding regions...');
    for (const r of REGIONS) {
      await query(
        `INSERT INTO spatial_geo (code, name, level, population, area_km2)
         VALUES ($1, $2, 'region', $3, $4)
         ON CONFLICT (code) DO UPDATE SET
           name = EXCLUDED.name,
           population = EXCLUDED.population,
           area_km2 = EXCLUDED.area_km2`,
        [r.code, r.name, r.population, r.area_km2]
      );
      console.log(`  ✅ ${r.name}`);
    }

    // --- 2. Insert Departments ---
    console.log('\n🏛️ Seeding departments...');
    for (const d of DEPARTMENTS) {
      const region = await query(`SELECT id FROM spatial_geo WHERE code = $1 AND level = 'region'`, [d.region_code]);
      if (region.rowCount === 0) continue;
      await query(
        `INSERT INTO spatial_geo (code, name, level, parent_id, population)
         VALUES ($1, $2, 'department', $3, $4)
         ON CONFLICT (code) DO UPDATE SET
           name = EXCLUDED.name,
           parent_id = EXCLUDED.parent_id,
           population = EXCLUDED.population`,
        [d.code, d.name, region.rows[0].id, d.population]
      );
      console.log(`  ✅ ${d.name} (${d.region_code})`);
    }

    // --- 3. Insert Districts ---
    console.log('\n🏘️ Seeding districts...');
    for (const d of DISTRICTS) {
      const dept = await query(`SELECT id FROM spatial_geo WHERE code = $1 AND level = 'department'`, [d.dept_code]);
      if (dept.rowCount === 0) continue;
      await query(
        `INSERT INTO spatial_geo (code, name, level, parent_id)
         VALUES ($1, $2, 'district', $3)
         ON CONFLICT (code) DO UPDATE SET
           name = EXCLUDED.name,
           parent_id = EXCLUDED.parent_id`,
        [d.code, d.name, dept.rows[0].id]
      );
      console.log(`  ✅ ${d.name} (${d.dept_code})`);
    }

    // --- 4. Insert Villages ---
console.log('\n🏡 Seeding villages...');
for (const v of VILLAGES) {
  const district = await query(`SELECT id FROM spatial_geo WHERE code = $1 AND level = 'district'`, [v.district_code]);
  if (district.rowCount === 0) {
    console.log(`  ⚠️ District ${v.district_code} not found, skipping ${v.name}`);
    continue;
  }
  await query(
    `INSERT INTO spatial_geo (code, name, level, parent_id, population)
     VALUES ($1, $2, 'village', $3, $4)
     ON CONFLICT (code) DO UPDATE SET
       name = EXCLUDED.name,
       parent_id = EXCLUDED.parent_id,
       population = EXCLUDED.population`,
    [v.code, v.name, district.rows[0].id, v.population]
  );
  console.log(`  ✅ ${v.name} (${v.district_code})`);
}

    // --- 5. Insert Indicators ---
    console.log('\n📊 Seeding indicators...');
    for (const ind of INDICATORS) {
      await query(
        `INSERT INTO indicators (code, name, unit, category, is_active)
         VALUES ($1, $2, $3, $4, true)
         ON CONFLICT (code) DO UPDATE SET
           name = EXCLUDED.name,
           unit = EXCLUDED.unit,
           category = EXCLUDED.category`,
        [ind.code, ind.name, ind.unit, ind.category]
      );
      console.log(`  ✅ ${ind.name}`);
    }

    // --- 6. Insert Data Values ---

    // Helper function
    async function insertDataValue(geoCode: string, indCode: string, value: number, year: number = 2026) {
      const geo = await query(`SELECT id FROM spatial_geo WHERE code = $1`, [geoCode]);
      const ind = await query(`SELECT id FROM indicators WHERE code = $1`, [indCode]);
      if (geo.rowCount && ind.rowCount) {
        await query(
          `INSERT INTO data_values (geography_id, indicator_id, year, value, gender, age_group, source)
           VALUES ($1, $2, $3, $4, 'all', 'all', 'Fictitious Census 2026')
           ON CONFLICT (geography_id, indicator_id, year, gender, age_group)
           DO UPDATE SET value = EXCLUDED.value`,
          [geo.rows[0].id, ind.rows[0].id, year, value]
        );
        return true;
      }
      return false;
    }

    // Regions data
    console.log('\n📈 Seeding region data values...');
    let count = 0;
    for (const [code, data] of Object.entries(REGION_DATA)) {
      for (const [indCode, value] of Object.entries(data)) {
        if (await insertDataValue(code, indCode, value)) count++;
      }
      console.log(`  ✅ ${code}: ${Object.keys(data).length} indicators`);
    }

    // Departments data
    console.log('\n📈 Seeding department data values...');
    for (const [code, data] of Object.entries(DEPT_DATA)) {
      for (const [indCode, value] of Object.entries(data)) {
        await insertDataValue(code, indCode, value);
        count++;
      }
      console.log(`  ✅ ${code}: ${Object.keys(data).length} indicators`);
    }

    // Districts data
    console.log('\n📈 Seeding district data values...');
    for (const [code, data] of Object.entries(DIST_DATA)) {
      for (const [indCode, value] of Object.entries(data)) {
        await insertDataValue(code, indCode, value);
        count++;
      }
      console.log(`  ✅ ${code}: ${Object.keys(data).length} indicators`);
    }

    // Villages data
    console.log('\n📈 Seeding village data values...');
    for (const [name, data] of Object.entries(VILLAGE_DATA)) {
      // Find the village by name
      const village = await query(`SELECT id FROM spatial_geo WHERE name = $1 AND level = 'village'`, [name]);
      if (village.rowCount === 0) {
        console.log(`  ⚠️ Village "${name}" not found, skipping...`);
        continue;
      }
      for (const [indCode, value] of Object.entries(data)) {
        const ind = await query(`SELECT id FROM indicators WHERE code = $1`, [indCode]);
        if (ind.rowCount) {
          await query(
            `INSERT INTO data_values (geography_id, indicator_id, year, value, gender, age_group, source)
             VALUES ($1, $2, 2026, $3, 'all', 'all', 'Fictitious Census 2026')
             ON CONFLICT (geography_id, indicator_id, year, gender, age_group)
             DO UPDATE SET value = EXCLUDED.value`,
            [village.rows[0].id, ind.rows[0].id, value]
          );
          count++;
        }
      }
      console.log(`  ✅ ${name}: ${Object.keys(data).length} indicators`);
    }

    console.log(`  ✅ Total: ${count} data values seeded`);

    // --- 7. Create Admin User ---
    console.log('\n👤 Creating admin user...');

    const adminEmail = config.admin.email;
    const adminPassword = config.admin.password;
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    const { rows } = await query(
      `INSERT INTO users (email, password_hash, full_name, user_type, plan, monthly_limit, is_active, is_verified)
       VALUES ($1, $2, 'System Administrator', 'ADMIN', 'PAID', 9999999, true, true)
       ON CONFLICT (email) DO UPDATE SET
         password_hash = EXCLUDED.password_hash
       RETURNING id`,
      [adminEmail, hashedPassword]
    );

    const adminId = rows[0].id;

    // --- 8. Create Admin API Key ---
    const { raw, prefix } = generateApiKey();
    const hashedKey = await hashApiKey(raw);

    await query(
      `INSERT INTO api_keys (user_id, name, key_hash, key_prefix)
       VALUES ($1, 'admin', $2, $3)`,
      [adminId, hashedKey, prefix]
    );

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔑 ADMIN CREDENTIALS:');
    console.log(`   Email:    ${adminEmail}`);
    console.log(`   Password: ${adminPassword}`);
    console.log(`   API Key:  ${raw}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    console.log('\n🎉 Seed completed successfully!');
    console.log(`   - ${REGIONS.length} regions`);
    console.log(`   - ${DEPARTMENTS.length} departments`);
    console.log(`   - ${DISTRICTS.length} districts`);
    console.log(`   - ${VILLAGES.length} villages`);
    console.log(`   - ${INDICATORS.length} indicators`);
    console.log(`   - ${count} data values`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  } catch (error) {
    console.error('❌ Seed error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

seed();