import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';

/**
 * Custom render function that includes common providers
 */
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
    route?: string;
    withRouter?: boolean;
}

export function renderWithProviders(
    ui: ReactElement,
    { route = '/', withRouter = true, ...renderOptions }: CustomRenderOptions = {}
): ReturnType<typeof render> {
    if (withRouter) {
        window.history.pushState({}, 'Test page', route);
    }

    const Wrapper = ({ children }: { children: React.ReactNode }) => {
        if (withRouter) {
            return <BrowserRouter>{children} </BrowserRouter>;
        }
        return <>{children} </>;
    };

    return render(ui, { wrapper: Wrapper, ...renderOptions });
}

/**
 * Mock apiClient for tests
 */
export function mockApiClient(): {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    getTyped: ReturnType<typeof vi.fn>;
    postTyped: ReturnType<typeof vi.fn>;
    postVoid: ReturnType<typeof vi.fn>;
    upload: ReturnType<typeof vi.fn>;
    configure: ReturnType<typeof vi.fn>;
    setAuthToken: ReturnType<typeof vi.fn>;
    getAccessToken: ReturnType<typeof vi.fn>;
    ensureAuth: ReturnType<typeof vi.fn>;
} {
    return {
        get: vi.fn(),
        post: vi.fn(),
        delete: vi.fn(),
        getTyped: vi.fn(),
        postTyped: vi.fn(),
        postVoid: vi.fn(),
        upload: vi.fn(),
        configure: vi.fn(),
        setAuthToken: vi.fn(),
        getAccessToken: vi.fn(),
        ensureAuth: vi.fn(),
    };
}

/**
 * Mock SocketService for tests
 */
export function mockSocketService(): {
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    emit: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
    joinRoom: ReturnType<typeof vi.fn>;
    leaveRoom: ReturnType<typeof vi.fn>;
    isConnected: ReturnType<typeof vi.fn>;
} {
    return {
        connect: vi.fn(),
        disconnect: vi.fn(),
        emit: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
        joinRoom: vi.fn(),
        leaveRoom: vi.fn(),
        isConnected: vi.fn(() => true),
    };
}

/**
 * Mock YDocManager for tests
 */
export function mockYDocManager(): {
    getOrCreate: ReturnType<typeof vi.fn>;
    applyInitialSync: ReturnType<typeof vi.fn>;
    applyRemoteUpdate: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
    setSendUpdateCallback: ReturnType<typeof vi.fn>;
} {
    return {
        getOrCreate: vi.fn(),
        applyInitialSync: vi.fn(),
        applyRemoteUpdate: vi.fn(),
        subscribe: vi.fn(() => () => {}),
        setSendUpdateCallback: vi.fn(),
    };
}

// Re-export testing library utilities
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
export { renderWithProviders as render };
