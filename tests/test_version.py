"""Tests for exposed package version metadata."""


def test_version_is_accessible() -> None:
    """
    Verify package exposes a non-empty __version__ attribute.

    Args:
    - None (None): Imports package metadata directly from module namespace.

    Returns:
    - None: Assertions validate version presence and value shape.
    """

    import markdown_os

    assert hasattr(markdown_os, "__version__")
    assert isinstance(markdown_os.__version__, str)
    assert markdown_os.__version__ != ""
