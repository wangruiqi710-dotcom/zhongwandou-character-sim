export const FACE=['face_shape_id','brow_shape_id','eye_shape_id','nose_shape_id','mouth_shape_id'];
export const COLORS=['hair_color_id','eye_color_id','skin_tone_id'];
export const TALENTS=['intelligence','social','athletic','stress_resistance','curiosity'];
export const PERSONALITY=['extraversion','intuition','thinking','planning'];
// MOCK_ONLY IDs and weights. Skin IDs are the four formal IDs; no art is copied.
export const POOLS=Object.fromEntries(FACE.map(k=>[k,[{id:'mock_'+k+'_01',weight:6},{id:'mock_'+k+'_02',weight:3},{id:'mock_'+k+'_03',weight:1}]]));
export const COLOR_POOLS={hair_color_id:['mock_hair_01','mock_hair_02','mock_hair_03'],eye_color_id:['mock_eye_01','mock_eye_02','mock_eye_03'],skin_tone_id:['skin_01','skin_02','skin_03','skin_04']};
export const HAIRSTYLES=['mock_style_01','mock_style_02','mock_style_03'];
export const BODY=['偏瘦','匀称','壮实'];
