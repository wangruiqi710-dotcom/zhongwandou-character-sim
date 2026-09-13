// The legacy engine expects these two display helpers, supplied without loading legacy app.js.
function round(v,n=0){return Math.round(v*10**n)/10**n;}
function simpleIdentity(age,_unused,worldId){return age<6?'幼儿':worldId==='ancient'?'农户家庭成员':age<18?'学生':'工作';}
