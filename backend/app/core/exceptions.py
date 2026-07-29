class ProviderConfigurationError(Exception):
    pass


class ProviderRequestError(Exception):
    pass


class ProviderAuthError(Exception):
    """The provider rejected the API key (401/403).

    Deliberately NOT a subclass of ProviderRequestError: services catch that one
    and silently fall back to heuristics, which would hide a wrong key behind a
    HTTP 200 full of regex-parsed data. This one must reach the client as a 401.
    """

    pass


class ProviderResponseFormatError(Exception):
    pass
