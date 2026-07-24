import logging


REDACTED_HEADERS = {"x-provider-api-key", "authorization"}


class SensitiveHeaderFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        message = str(record.msg)
        for header_name in REDACTED_HEADERS:
            if header_name in message.lower():
                record.msg = "[redacted sensitive header content]"
                break
        return True
