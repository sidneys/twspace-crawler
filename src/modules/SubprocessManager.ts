import winston from 'winston'
import stringArgv from 'string-argv'
import { ChildProcess, spawn, SpawnOptions } from 'child_process'
import { logger as baseLogger } from '../logger'

type SubprocessId = number

interface SubprocessInfo {
  childProcess: ChildProcess
  completionCommand?: string
}

class SubprocessManager {
  private logger: winston.Logger
  private subprocessStore: Record<SubprocessId, SubprocessInfo> = {}

  constructor() {
    this.logger = baseLogger.child({ label: '[SubprocessManager]' })
  }

  /**
   * Remove a subprocess from the store
   * @param {SubprocessId} subprocessId - Process identifier of sub process record
   * @private
   */
  private remove(subprocessId: SubprocessId) {
    if (!this.subprocessStore[subprocessId]) {
      return
    }
    delete this.subprocessStore[subprocessId]

    this.logger.debug(`remove() (pid: ${subprocessId})`)
  }

  /**
   * Add a subprocess to the store
   * @param {SubprocessInfo} subprocessInfo - Sub process record
   * @private
   */
  private add(subprocessInfo: SubprocessInfo) {
    if (this.subprocessStore[subprocessInfo.childProcess.pid]) {
      return
    }
    this.subprocessStore[subprocessInfo.childProcess.pid] = subprocessInfo

    this.logger.debug(`add() (pid: ${subprocessInfo.childProcess.pid})`)
  }

  /**
   * Monitor a child process during its life cycle
   * @param {ChildProcess} childProcess - Child process to monitor
   * @param {string?} completionCommand - Command to run after child process exits
   */
  public monitor(childProcess: ChildProcess, completionCommand?: string) {
    /** @listens ChildProcess#error */
    childProcess.on('error', (error) => {
      this.logger.error(`#error (message: ${error.message}) (pid: ${childProcess.pid}) (spawnfile: ${childProcess.spawnfile})`)
      this.logger.debug('#error', error)
    })

    /** @listens ChildProcess#spawn */
    childProcess.on('spawn', () => {
      this.logger.debug(`#spawn (pid: ${childProcess.pid}) (spawnfile: ${childProcess.spawnfile})`)
      // Add child processes to store
      this.add({
        childProcess,
        completionCommand,
      })
    })

    /** @listens ChildProcess#exit */
    childProcess.on('exit', (code, signal?) => {
      this.logger.debug(`#exit (pid: ${childProcess.pid}) (spawnfile: ${childProcess.spawnfile}) (code: ${code}) (signal: ${signal || 'N/A'})`)
      // Execute completion command as new child process
      const command = this.subprocessStore[childProcess.pid]?.completionCommand
      if (command) {
        const argv = stringArgv(command)
        this.start(argv[0], argv.slice(1))
      }
      // Remove subprocess from store
      this.remove(childProcess.pid)
    })
  }

  /**
   * Execute a command as a child process.
   * Optionally, run a second command after the first command exits.
   * @param {string} cmd - Command to run
   * @param {string[]} args - List of string arguments
   * @param {string?} completionCommand - Command string to execute upon completion of first command
   */
  public start(cmd: string, args: string[], completionCommand?: string): ChildProcess {
    this.logger.verbose(`start() (command: ${cmd} ${args.join(' ')}) (completion command: ${completionCommand || 'N/A'})`)

    // https://github.com/nodejs/node/issues/21825
    const spawnOptions: SpawnOptions = {
      cwd: process.cwd(),
      stdio: 'ignore',
      detached: false,
      windowsHide: true,
    }

    const cp = process.platform === 'win32'
      ? spawn(process.env.comspec, ['/c', cmd, ...args], spawnOptions)
      : spawn(cmd, args, spawnOptions)
    // cp.unref()

    this.monitor(cp, completionCommand)

    return cp
  }
}

export const subprocessManager = new SubprocessManager()
