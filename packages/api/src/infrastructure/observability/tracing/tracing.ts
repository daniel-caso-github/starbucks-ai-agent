import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

let sdk: NodeSDK | null = null;
let isShuttingDown = false;

export function initTracing(serviceName: string, serviceVersion: string): NodeSDK | null {
  if (process.env.OTEL_ENABLED !== 'true') {
    return null;
  }

  const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: serviceVersion,
    }),
    traceExporter: new OTLPTraceExporter({
      url: `${otlpEndpoint}/v1/traces`,
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-http': { enabled: true },
        '@opentelemetry/instrumentation-express': { enabled: true },
        '@opentelemetry/instrumentation-mongodb': { enabled: true },
        '@opentelemetry/instrumentation-ioredis': { enabled: true },
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-dns': { enabled: false },
      }),
    ],
  });

  sdk.start();
  console.log('OpenTelemetry tracing initialized');

  // Register shutdown handlers for multiple signals
  const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
  signals.forEach((signal) => {
    process.on(signal, async () => {
      await shutdownTracing();
      process.exit(0);
    });
  });

  // Handle uncaught exceptions and unhandled rejections
  process.on('beforeExit', async () => {
    await shutdownTracing();
  });

  return sdk;
}

export async function shutdownTracing(): Promise<void> {
  // Prevent multiple shutdown calls
  if (isShuttingDown || !sdk) {
    return;
  }

  isShuttingDown = true;

  try {
    // Use a timeout to prevent hanging
    const shutdownPromise = sdk.shutdown();
    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(() => {
        console.log('OpenTelemetry shutdown timeout - forcing termination');
        resolve();
      }, 3000); // 3 second timeout
    });

    await Promise.race([shutdownPromise, timeoutPromise]);
    console.log('OpenTelemetry tracing terminated');
  } catch (error) {
    console.error('Error shutting down OpenTelemetry:', error);
  } finally {
    sdk = null;
    isShuttingDown = false;
  }
}
