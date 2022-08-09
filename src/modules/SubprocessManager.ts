import winston from 'winston'
import { ChildProcess, spawn, SpawnOptions } from 'child_process'
import { logger as baseLogger } from '../logger'

class SubprocessManager {
  private logger: winston.Logger
  private activeSubprocesses: Record<number, ChildProcess> = {}

  constructor() {
    this.logger = baseLogger.child({ label: '[SubprocessMonitor]' })
  }

  private remove(processId: number) {
    // Delete Record
    const subprocesses = this.activeSubprocesses
    if (!subprocesses[processId]) { return }
    delete subprocesses[processId]
    this.logger.debug(`remove subprocess (pid: ${processId})`)
  }

  private add(subprocess: ChildProcess) {
    // Create Record
    const subprocesses = this.activeSubprocesses
    if (subprocesses[subprocess.pid]) { return }
    subprocesses[subprocess.pid] = subprocess
    this.logger.debug(`add subprocess (pid: ${subprocess.pid})`)
  }

  private monitor(subprocess: ChildProcess) {
    // Event: #spawn - Add to active subprocess list
    subprocess.on('spawn', () => {
      this.logger.debug(`subprocess #spawn (command: ${subprocess.spawnfile}) (pid: ${subprocess.pid})`)
      // Add subprocess to active subprocess list
      this.add(subprocess)
    })

    // Event: #exit - Remove from active subprocess list
    subprocess.on('exit', (code, signal) => {
      this.logger.debug(`subprocess #exit (code: ${code}) (signal: ${signal}) (command: ${subprocess.spawnfile}) (pid: ${subprocess.pid})`)
      this.remove(subprocess.pid)
    })
  }

  public getSubprocesses(): ChildProcess[] {
    return Object.values(this.activeSubprocesses)
  }

  public getSubprocessByPid(processId: number): ChildProcess | void {
    return this.activeSubprocesses[processId]
  }

  public startSubprocess(cmd: string, args: Array<any>): ChildProcess {
    // https://github.com/nodejs/node/issues/21825
    const spawnOptions: SpawnOptions = {
      cwd: process.cwd(),
      stdio: 'ignore',
      detached: false,
      windowsHide: true,
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const subprocess = process.platform === 'win32'
      ? spawn(process.env.comspec, ['/c', cmd, ...args], spawnOptions)
      : spawn(cmd, args, spawnOptions)
    // subprocess.unref()

    this.monitor(subprocess)

    return subprocess
  }
}

export const subprocessManager = new SubprocessManager()
