import { expect } from '@hapi/code'
import * as Lab from '@hapi/lab'
import stringArgv from 'string-argv'
import { SubprocessManager } from '../src/modules/SubprocessManager'

const lab = Lab.script()
const { describe, it, beforeEach } = lab
export { lab }

// /**
//  * @param {string} processName The executable name to check
//  * @param {function} cb The callback function
//  * @returns {boolean} True: Process running, else false
//  */
// const isProcessRunning = async (processName: string): Promise<boolean> => {
//   const cmd = (() => {
//     switch (process.platform) {
//       case 'win32': return 'tasklist'
//       case 'darwin': return `ps aux | grep -v grep | grep ${processName}`
//       case 'linux': return 'ps -A'
//       default: return ''
//     }
//   })()
//
//   return new Promise((resolve, reject) => {
//     exec(cmd, (error: Error, stdout: string) => {
//       if (error) { reject(error) }
//       resolve(stdout.toLowerCase().includes(processName.toLowerCase()))
//     })
//   })
// }

describe('SubprocessManager', () => {
  let subprocessManager

  // const modulePath = '../src/modules/SubprocessManager'
  beforeEach(() => {
    subprocessManager = SubprocessManager.getInstance()

    // return import( modulePath).then(module => {
    //   subprocessManager = module
    //   // jest.resetModules()
    //   delete require.cache[require.resolve(modulePath)]
    //   require(modulePath)
    // })
  })

  it('should have an empty store of managed child processes', () => {
    const childprocesses = subprocessManager.listAll()

    expect(childprocesses).to.be.empty()
  })

  it('should create a ChildProcess instance', () => {
    const childprocess = subprocessManager.start('node')

    expect(childprocess.constructor.name).to.equal('ChildProcess')
  })

  it('should execute a command as a managed child process', () => {
    const childprocess = subprocessManager.start('node')

    childprocess.on('spawn', () => {
      expect(childprocess.pid).to.be.a.number()
    })
  })

  it('should fail to execute command as a managed child process', async () => {
    const childprocess = subprocessManager.start('abcdefghi')

    expect(childprocess).to.be.undefined()
  })

  it('should execute a command with arguments as a managed child process', () => {
    const childprocess = subprocessManager.start('node', ['--test', '--test', '--test'])

    childprocess.on('spawn', () => {
      expect(childprocess.spawnargs.slice(1)).to.have.length(3)
    })
  })

  it('should start multiple background child processes', () => {
    const argv = ['--title=SubprocessManagerTest']

    subprocessManager.start('node', argv)
    subprocessManager.start('node', argv)
    subprocessManager.start('node', argv)
    const childprocesses = subprocessManager.listAll()

    expect(childprocesses).to.have.length(3)

    // Quit child processes
    childprocesses.forEach(((childprocess) => childprocess.kill(('SIGKILL'))))
  })

  it('should start and look up a child process using private interface', () => {
    const childprocess = subprocessManager.start('node', ['--title=SubprocessManagerTest'])

    const subprocessInfo = subprocessManager.get(childprocess.pid)

    expect(subprocessInfo).to.be.an.object()
    expect(subprocessInfo.process.constructor.name).to.equal('ChildProcess')
    expect(subprocessInfo.completion).to.be.undefined()
  })

  it('should start a child process, exit it, and launch a second child process', async () => {
    // Command 1: Exits immediately
    const command1 = 'node'
    // Command 2: Runs continuously
    const command2 = process.platform === 'win32' ? 'ping -t 1.1.1.1' : 'ping 1.1.1.1'

    // Start command 1, supplying command 2 for child process 2
    subprocessManager.start(command1, ['--test'], command2)

    // Wait until child process 1 has exited
    // eslint-disable-next-line no-promise-executor-return
    await new Promise((r) => setTimeout(r, 5000))

    // Lookup child process launched by command 2
    const childprocesses = subprocessManager.listAll()
    // eslint-disable-next-line max-len
    const childprocess2 = childprocesses.find((childprocess) => String(childprocess.spawnargs) === String(stringArgv(command2)))

    expect(childprocess2.constructor.name).to.equal('ChildProcess')

    // Quit child processes
    childprocesses.forEach(((childprocess) => childprocess.kill(('SIGKILL'))))
  })
})
