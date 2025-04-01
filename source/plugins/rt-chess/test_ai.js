const { exec } = require('child_process');
// 输出当前目录（不一定是代码所在的目录）下的文件和文件夹
async function robot_best_move(fen_str)
{
    let time = Date.now()
    let result = await new Promise((resolve)=>{
        //'type '+filename+"|
        let childP = exec(__dirname+"\\pikafish-modern.exe", (err, stdout, stderr) => {
            if(err) {
                console.log(err);
                return;
            }
            if(!stdout) return resolve(null)
            // console.log(`stdout: ${stdout}`,stdout);
            // console.log(`stderr: ${stderr}`);
            let ret = stdout.split('ponder')[0].split('bestmove')[1].trim()
            console.log('ret:',ret,Date.now()-time)
            resolve(ret)
        })
        // console.log('childP:',childP)
        childP.stdin.write('position fen '+fen_str+'\n')
        childP.stdin.write('go depth 20\n')
        setTimeout(()=>childP.stdin.write('quit\n'),2000)
        // childP.stdin.write('go ponder\n')
        // setTimeout(()=>childP.stdin.write('stop\n'),1300)
        setTimeout(()=>resolve(null),10000)
    })
    return result
}
async function test()
{
    let r0 = await robot_best_move('rnbakabnr/9/1c2c4/p1p3p1p/9/4p1P2/P1P5P/1C5C1/9/RNBAKABNR w')
    console.log('r0:',r0)
}

test()

// console.log('12345'.slice(0,4))