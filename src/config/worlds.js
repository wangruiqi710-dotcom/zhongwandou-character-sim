// Reuse existing world cards; all new datasets are MOCK_ONLY.
export const world=id=>globalThis.PeaDecision.WORLD_CONFIGS[id];
export const DATASETS={
modern:{education:[{id:'school',name:'学校学习',skill:'阅读',time:.65},{id:'training',name:'职业培训',skill:'编程',time:.6}],careers:[{id:'workshop',name:'技术工作',skill:'编程',wage:1.3,time:.7},{id:'service',name:'服务工作',skill:'沟通',wage:1,time:.65},{id:'craft',name:'手工工作',skill:'手工',wage:.9,time:.6}]},
ancient:{education:[{id:'school',name:'识字学习',skill:'读书',time:.65},{id:'training',name:'作坊学艺',skill:'手工',time:.6}],careers:[{id:'workshop',name:'作坊工匠',skill:'手工',wage:1.2,time:.7},{id:'service',name:'商铺帮工',skill:'经商',wage:1,time:.65},{id:'craft',name:'农事劳动',skill:'农事',wage:.9,time:.6}]}
};
