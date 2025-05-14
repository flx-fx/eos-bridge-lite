import 'easymidi'

declare module 'easymidi' {
  interface Input {
    on(event: 'message', listener: (msg: any) => void): this
  }
}
