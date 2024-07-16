type NewType<name extends string, base = string> = base & {
  [_ in `__NewType_${name}`]: undefined
}

// This is intentionally not strictly typed, so that this package does
// not need to be rebuild each time a blockchain is added.
export type UntypedConnectorKind = string

export type CoreNufiMessage = {
  appId: string
  method: string
}

export type NufiMessage = CoreNufiMessage & {
  connectorPlatform: ConnectorPlatform
}

export type WidgetSessionData = {
  connectorPlatform: ConnectorPlatform
  connectorKind: UntypedConnectorKind
}

export type InitChannelData = {
  type: 'widget'
  data: WidgetSessionData
}

// This message kind just serves to transfer over the MessagePort object.
export type InitChannelMessage = NufiMessage & {
  method: 'initChannel'
  data?: InitChannelData
}

// This message is used to ping a channel until it is ready to establish a connection.
// The message is used with channels which require some time to "boot" or are initialized
// on demand, for example they are running within iframe.
export type PingChannelMessage = NufiMessage & {
  method: 'channelPing'
  data: WidgetSessionData
}

// `[]` is used instead of any, since `any & ...` is just reduced to `any`
export type RequestArgument = NewType<'RequestArgument', []>
export type SuccessResponse = NewType<'SuccessResponse', []>
export type ErrorResponse = NewType<'ErrorResponse', []>

type TrustedRequestContext = {
  origin: string
  favIconUrl?: string
}

// This is used to augment requests with some additional metadata
export type RequestContext = {
  // data originating from trusted sources
  trusted: TrustedRequestContext
}

// Though having such a specific type may cause unnecessary changes to this package,
// given it is not expected to change often, and provides better safety across packages,
// we are going the strict union approach.
export type ScriptContext =
  | 'injectedScript'
  | 'contentScript'
  | 'serviceWorker'
  | 'connectorWindow'
  | 'app'
  | 'sdk'
  | 'widget'

export interface MessageHeader {
  senderContext: ScriptContext
  targetContext: ScriptContext
}

// This message is sent from the injected connector interface.
export interface RequestMessage<ConnectorKind extends UntypedConnectorKind>
  extends MessageHeader {
  /** The unique identifier of this request (random UUID). */
  id: string
  connectorKind: null | ConnectorKind
  method: string
  args: RequestArgument[]
  // Added in SDK "0.2.1",
  priorityTimestamp: string
}

export type Response<T, E> =
  | {kind: 'success'; value: T}
  | {kind: 'error'; value: E}

export type MessageToClientResponse = MessageHeader & {
  // This message is sent as response to a request. The `id` field serves to
  // identify it with the original `RequestMessage` that this is a response
  // to.
  type: 'response'
  id: string
  result: Response<SuccessResponse, ErrorResponse>
}

export type MessageToClientEvent<ConnectorKind extends UntypedConnectorKind> =
  MessageHeader & {
    type: 'event'
    targetOrigin: string
    connectorKind: ConnectorKind
    method: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    args: any[]
  }

export type MessageToClient<ConnectorKind extends UntypedConnectorKind> =
  | MessageToClientResponse
  | MessageToClientEvent<ConnectorKind>

export type SendRequest = (
  method: string,
  args: RequestArgument[],
) => Promise<SuccessResponse>

export type ServiceEvent = 'connectorWindowClosed' | 'connectorWindowOpen'

export type EventHandler = (
  method: ServiceEvent,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any[],
) => Promise<void>

export type Handler = (
  method: string,
  args: RequestArgument[],
  context: RequestContext,
) => Promise<Response<SuccessResponse, ErrorResponse>>

// The MessagingClient is considered an internal api, as the messages can carry stuff other than connector calls.
// The decision to flatten everything into a single namespace was made, as at that point no connectors were sending unfiltered messages anyway.
export interface MessagingClient {
  sendRequest(
    method: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    args: any[],
  ): Promise<SuccessResponse> /* rejects with ErrorResponse */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  proxy: {[_ in string]: (...args: any[]) => Promise<any>}
  openConnectorWindow(meta?: unknown): Promise<void>
  closeConnectorWindow(): Promise<void>
  /** Get the state of the connector window tracked automatically on the client side. */
  isConnectorWindowOpen(): boolean
  /** Get the state of the connector window tracked in connector window that remains
   * open even on Dapp refresh. */
  isConnectorWindowOpenAsync(): Promise<boolean>
}

/**
 * This represents a connector object, which can implement arbitrary things,
 * and is different across each connector. We can't model that in TS, so we
 * just fake the type.
 */
export type ConnectorObject = NewType<'ConnectorObject', []>

export type DappConnectorsConfig = {
  connectors: Record<UntypedConnectorKind, unknown>
  appId: string
  connectorPlatform: ConnectorPlatform
}

export type WalletOverrides = Record<string, boolean>

export type InjectedConnectorFactory<Config extends DappConnectorsConfig> = (
  client: MessagingClient,
  config: Config,
) => InjectedConnector

interface InjectedConnectorBase {
  connectorKind: UntypedConnectorKind
  eventHandler: EventHandler
}

export interface SimpleInjectedConnector extends InjectedConnectorBase {
  inject: (window: Window) => void
  type: 'simple'
}

export interface InjectedConnectorWithOverrides extends InjectedConnectorBase {
  inject: (window: Window, overrides: WalletOverrides | null) => void
  type: 'withOverrides'
}

export type InjectedConnector =
  | SimpleInjectedConnector
  | InjectedConnectorWithOverrides

export type ConnectorPlatform = 'extension' | 'sso' | 'snap'
