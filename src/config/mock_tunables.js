export const META={schema_version:3,mock_version:'2.2.0-alpha',design_version:'architecture_v014',design_sha256:'6654561CAF9BE64D01FD1118A8F84E84A693B0AAFAA80ACD7FAA62841DB82E76'};
export const GOALS=['职业成就','家庭生活','声望地位','财富积累'];
// Every value below is MOCK_TUNABLE, not a rule added to the frozen design.
export const TUNABLES={
 education_min_age:[6,3,12],safe_route_time:[.05,0,.2],
 work_reduction_fraction:[.2,.05,.5],minimum_work_time:[.2,.1,.5],education_reduced_fraction:[.5,.1,1],mentor_age:[38,18,70],
 event_cooldown:[6,1,24],background_cooldown:[3,1,24],recent_history_limit:[48,12,240],decision_stage_limit:[4,2,8],trial_months:[2,1,12],trial_time:[.15,.05,.5],
 situation_worsening:[8,1,30],situation_recovery:[12,1,30],situation_notice_step:[20,5,50],situation_decision_threshold:[60,20,100],situation_decision_cooldown:[6,1,24],
 away_income_multiplier:[1.3,.5,3],away_living_multiplier:[1.5,.5,3],marriage_candidate_count:[3,2,6],player_window_months:[3,3,12],player_event_cooldown:[12,3,36],family_support_months:[12,3,48],major_treatment_cost:[80,1,1000],major_treatment_gain:[30,1,60],

 continuous_genetics_in_range_weight:[.9,0,1],continuous_genetics_mutation_rate:[.1,0,1],continuous_genetics_mutation_range:[18,1,50],
 face_mutation_count_weights:[[.6,.3,.1]],body_parent_weight:[.85,0,1],
 background_event_frequency:[.22,0,1],decision_event_frequency:[.035,0,1],marriage_opportunity_frequency:[.035,0,1],
 personality_dimension:[.35,0,1],personality_total:[.8,0,2],interest_cap:[.45,0,2],goal_cap:[.5,0,2],talent_cap:[.15,0,1],
 jitter_scale:[.6,0,2],temperature_scale:[.65,0,2],stress_cap:[.5,0,2],relationship_cap:[.8,0,2],ordinary_push:[.8,0,3],
 initial_health:[90,1,100],health_recovery:[1,0,5],health_stress_damage:[.02,0,.2],aging_start:[60,40,100],aging_loss:[.6,0,3],aging_step_years:[10,1,30],illness_frequency:[.01,0,1],illness_loss:[18,0,100],
 wage:[100,0,10000],living_cost:[30,0,10000],education_cost:[12,0,1000],opportunity_cost:[120,0,10000],marriage_cost:[100,0,10000],
 support_fraction:[1,0,1],skill_growth:[1,0,10],education_months:[36,1,120],gestation_months:[9,1,24],birth_health_min:[35,1,100],birth_age_min:[18,18,30],birth_age_max:[45,30,60],
 marriage_min_age:[18,18,30],marriage_health_min:[25,1,100],reproduction_frequency:[.025,0,1],
 forced_stress:[30,0,100],forced_mood_loss:[25,0,100],forced_relationship_loss:[30,0,100],
 stress_recovery:[1,0,10],mood_recovery:[1,0,10],fatigue_recovery:[12,0,30],care_time:[.35,0,1],care_months:[36,1,120],
 background_delta:[3,0,20],household_conflict_months:[2,1,12],life_run_limit_months:[1500,120,2400],
 default_work_fatigue:[10,0,30],conflict_stress:[5,0,30],rest_mood_target:[65,0,100],
 stress_trigger:[65,0,100],relationship_conflict_trigger:[-20,-100,100],decision_stress_relief:[4,0,30],
 treatment_gain:[.2,0,20],adjustment_months:[12,1,120],temporary_distance_months:[3,1,24],
 goal_personality_weight:[1,0,3],interest_count:[3,2,4],
 education_progress_fraction:[.6,.1,1],force_initial_credit:[1,0,10],contact_population_limit:[24,5,100],contact_age_spread:[5,0,15],relocation_months:[36,1,120]
};
export const defaults=()=>Object.fromEntries(Object.entries(TUNABLES).map(([k,v])=>[k,structuredClone(v[0])]));
export function validateConfig(c){for(const [k,[,min,max]] of Object.entries(TUNABLES)){const v=c[k];if(k==='face_mutation_count_weights'){if(!Array.isArray(v)||v.length!==3||v.some(x=>!Number.isFinite(x)||x<0)||v.reduce((a,b)=>a+b,0)<=0)throw Error('五官变异权重需要三个非负数，合计大于0');}else if(!Number.isFinite(v)||v<min||v>max)throw Error('Mock 参数范围错误：'+k);}return c;}
