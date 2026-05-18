class ProcessingError(RuntimeError):
    status_code = 500


class ConfigurationError(ProcessingError):
    status_code = 503


class ImageryFetchError(ProcessingError):
    status_code = 502


class ImageAnalysisError(ProcessingError):
    status_code = 422
