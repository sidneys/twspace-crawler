import winston from 'winston'
import stringArgv from 'string-argv'
import { ChildProcess, spawn, SpawnOptions } from 'child_process'
import { logger as baseLogger } from '../logger'

/**
 * Process Identifier (PID)
 * @typedef {number} ProcessId
 */
type ProcessId = number

/**
 * Subprocess Information Object
 */
interface SubprocessInfo {
  /** Reference to ChildProcess instance */
  process: ChildProcess
  /** Command executed after referenced ChildProcess instance exits */
  completion?: string
}

/**
 * Class for starting and managing background processes
 */
class SubprocessManager {
  private logger: winston.Logger
  private subprocessStore: Record<ProcessId, SubprocessInfo> = {}

  constructor() {
    this.logger = baseLogger.child({ label: '[SubprocessManager]' })
    this.logger.debug('constructor')
  }

  static getInstance() {
    return new SubprocessManager()
  }

  /**
   * Retrieve subprocess object from store
   * @param {ProcessId} processId - Process identifier of sub process
   * @returns {SubprocessInfo} - Sub process info
   * @private
   */
  private get(processId: ProcessId): SubprocessInfo {
    return this.subprocessStore[processId]
  }

  /**
   * Remove a subprocess object from store
   * @param {ProcessId} processId - Process identifier of stored sub process object
   * @private
   */
  private remove(processId: ProcessId) {
    if (!this.get(processId)) { return }
    delete this.subprocessStore[processId]

    this.logger.debug(`remove() (pid: ${processId})`)
  }

  /**
   * Add subprocess object to store
   * @param {SubprocessInfo} subprocessInfo - Sub process object
   * @private
   */
  private add(subprocessInfo: SubprocessInfo) {
    if (this.get(subprocessInfo.process.pid)) { return }
    this.subprocessStore[subprocessInfo.process.pid] = subprocessInfo

    this.logger.debug(`add() (pid: ${subprocessInfo.process.pid})`)
  }

  /**
   * Get completion command of stored sub process objects
   * @param {ProcessId} processId - Process identifier of sub process
   * @returns {string|void} - Completion command stored for sub process
   * @private
   */
  private getCompletionCommand(processId: ProcessId): string {
    return this.get(processId).completion
  }

  /**
   * Retrieve a list of all managed child processes
   * @returns {ChildProcess[]} - List of child processes
   */
  public listAll(): ChildProcess[] {
    return Object.values(this.subprocessStore).map((element) => element.process)
  }

  /**
   * Monitor a child process during its life cycle
   * @param {ChildProcess} childprocess - Child process to monitor
   * @param {string=} completionCommand - Command to run after child process exits
   */
  public manage(childprocess: ChildProcess, completionCommand?: string) {
    // Add child process to store
    this.add({
      process: childprocess,
      completion: completionCommand,
    })

    // #exit Handler
    childprocess.on('exit', (code, signal?) => {
      this.logger.debug(`child process exited (pid: ${childprocess.pid}) (spawnfile: ${childprocess.spawnfile}) (code: ${code}) (signal: ${signal || 'N/A'})`)

      // Lookup completion command of stored sub processes
      const subprocessCompletionCommand = this.getCompletionCommand(childprocess.pid)
      if (subprocessCompletionCommand) {
        const argv = stringArgv(subprocessCompletionCommand)
        // Execute completion command of stored sub process
        this.start(argv[0], argv.slice(1))
      }

      // Remove subprocess from store
      this.remove(childprocess.pid)
    })
  }

  /**
   * Execute command as child process. Optionally run second command after first command exits.
   * @param {string} cmd - Command to run
   * @param {string[]} args - List of string arguments
   * @param {string=} completionCommand - Command string to execute upon completion of first command
   * @returns {ChildProcess|undefined} Launched child process
   */
  // eslint-disable-next-line
  public start(cmd: string, args = [], completionCommand?: string): ChildProcess|undefined {
    this.logger.debug(`start() (command: ${cmd}) (arguments: ${args.length ? args.join(' ') : '–'}) (completion command: ${completionCommand || '–'})`)

    // https://github.com/nodejs/node/issues/21825
    const spawnOptions: SpawnOptions = {
      cwd: process.cwd(),
      stdio: 'ignore',
      detached: false,
      windowsHide: true,
    }

    const childprocess = process.platform === 'win32'
      ? spawn(process.env.comspec, ['/c', cmd, ...args], spawnOptions)
      : spawn(cmd, args, spawnOptions)
    // cp.unref()

    // // #error Handler
    childprocess.on('error', (error) => {
      this.logger.error(`child process spawn error (message: ${error.message}) (pid: ${childprocess.pid}) (spawnfile: ${childprocess.spawnfile})`)
    })

    // Handle failure to spawn
    if (!childprocess.pid) {
      this.logger.error('child process spawn error: pid missing', { childprocess })
      return undefined
    }

    this.manage(childprocess, completionCommand)

    return childprocess
  }
}

// Create shared / cached instance
const subprocessManager = new SubprocessManager()

/**
 * @export subprocessManager: Instance (Singleton)
 * @export SubprocessManager: Base Class with static interface
 */
export { subprocessManager, SubprocessManager }
