import {META} from '../config/mock_tunables.js';
import {clone} from '../core/state.js';
import {command} from '../core/simulation.js';
export function newRun(state,mode='life',case_id='life'){
 const run_id=globalThis.crypto.randomUUID();return {...META,run_id,test_mode:mode,test_case_id:case_id,seed:state.seed,initial_state:clone(state),state,commands:[],created_at:new Date().toISOString()};
}
export function step(run,cmd){if(run.mock_version!==META.mock_version||run.schema_version!==META.schema_version)throw Error('旧版本存档仅可查看和导出，请新建本版运行；未静默修改旧数据');const backup=clone({...run.state,history:[]});backup.history=[...run.state.history];let entry;try{entry=command(run.state,cmd);}catch(e){run.state=backup;throw e;}run.commands.push(clone(cmd));entry.command_index=run.commands.length-1;return entry;}
export function replay(run,index=run.commands.length-1){if(run.mock_version!==META.mock_version||run.design_sha256!==META.design_sha256)throw Error('该记录来自旧 Mock 版本或其他设计版本');const s=clone(run.initial_state);for(let i=0;i<=index;i++)command(s,run.commands[i]);return s;}
