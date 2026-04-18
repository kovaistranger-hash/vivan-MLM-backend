type StartupPhase =
  | 'initializing'
  | 'connecting_database'
  | 'bootstrapping_schema'
  | 'starting_http'
  | 'ready'
  | 'failed';

type RuntimeHealthState = {
  startedAt: string;
  phase: StartupPhase;
  ready: boolean;
  http: {
    listening: boolean;
    port: number | null;
  };
  database: {
    configured: boolean;
    source: string | null;
    host: string | null;
    database: string | null;
    connected: boolean;
    schemaBootstrapped: boolean;
    lastError: string | null;
  };
  startupError: string | null;
};

const state: RuntimeHealthState = {
  startedAt: new Date().toISOString(),
  phase: 'initializing',
  ready: false,
  http: {
    listening: false,
    port: null
  },
  database: {
    configured: false,
    source: null,
    host: null,
    database: null,
    connected: false,
    schemaBootstrapped: false,
    lastError: null
  },
  startupError: null
};

export function setStartupPhase(phase: StartupPhase) {
  state.phase = phase;
  if (phase !== 'failed') {
    state.startupError = null;
  }
}

export function setDatabaseConfig(input: {
  configured: boolean;
  source: string | null;
  host: string | null;
  database: string | null;
}) {
  state.database.configured = input.configured;
  state.database.source = input.source;
  state.database.host = input.host;
  state.database.database = input.database;
}

export function setDatabaseConnected(connected: boolean, lastError?: string | null) {
  state.database.connected = connected;
  state.database.lastError = lastError ?? null;
}

export function setSchemaBootstrapped(schemaBootstrapped: boolean, lastError?: string | null) {
  state.database.schemaBootstrapped = schemaBootstrapped;
  if (lastError !== undefined) {
    state.database.lastError = lastError;
  }
}

export function setHttpListening(port: number) {
  state.http.listening = true;
  state.http.port = port;
}

export function markReady() {
  state.ready = true;
  state.phase = 'ready';
  state.startupError = null;
}

export function markStartupFailed(error: unknown) {
  state.ready = false;
  state.phase = 'failed';
  state.startupError = error instanceof Error ? error.message : String(error);
}

export function getRuntimeHealth() {
  return {
    ...state,
    http: { ...state.http },
    database: { ...state.database },
    uptimeSeconds: Math.max(0, Math.floor(process.uptime()))
  };
}
