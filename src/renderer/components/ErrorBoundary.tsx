import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="p-8 bg-red-50 text-red-900 h-screen w-screen overflow-auto flex flex-col items-center justify-center">
                    <div className="bg-white p-6 rounded-xl shadow-xl max-w-2xl w-full border border-red-200">
                        <h1 className="text-xl font-bold mb-4 text-red-600">应用遇到了问题 (Application Error)</h1>
                        <p className="mb-2 text-gray-700">错误信息 (Error Message):</p>
                        <pre className="text-sm bg-gray-100 p-4 rounded text-red-800 whitespace-pre-wrap break-all border border-gray-200 font-mono">
                            {this.state.error?.toString()}
                            {this.state.error?.stack && `\n\nStack:\n${this.state.error.stack}`}
                        </pre>
                        <button
                            onClick={() => window.location.reload()}
                            className="mt-6 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                        >
                            刷新页面 (Reload)
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
