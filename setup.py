from setuptools import setup, find_packages

setup(
    name="kuma-sync",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        "python-socketio[client]>=5.8.0",
        "websocket-client>=1.6.0",
        "click>=8.0.0",
        "pyyaml>=6.0",
        "python-dotenv>=1.0.0",
    ],
    entry_points={
        "console_scripts": [
            "kuma-sync=kuma_sync.cli:cli",
        ],
    },
    python_requires=">=3.7",
)
