export type AppAlertButtonStyle = 'default' | 'cancel' | 'destructive';

export interface AppAlertButton {
    readonly text?: string;
    readonly onPress?: () => void;
    readonly style?: AppAlertButtonStyle;
}

export interface AppAlertOptions {
    readonly cancelable?: boolean;
    readonly onDismiss?: () => void;
}

export interface AppAlertRequest {
    readonly title: string;
    readonly message?: string;
    readonly buttons?: readonly AppAlertButton[];
    readonly options?: AppAlertOptions;
}

type AppAlertPresenter = (request: AppAlertRequest) => void;

let presenter: AppAlertPresenter | null = null;

/**
 * Registers the app-level custom alert presenter.
 * WARNING: This should only be set by the root provider.
 */
export function setAppAlertPresenter(nextPresenter: AppAlertPresenter | null): void {
    presenter = nextPresenter;
}

function alert(
    title: string,
    message?: string,
    buttons?: readonly AppAlertButton[],
    options?: AppAlertOptions,
): void {
    if (presenter === null) {
        console.warn('[AppAlert] Alert requested before presenter was mounted.', { title, message });
        return;
    }

    presenter({
        title,
        message,
        buttons,
        options,
    });
}

/**
 * Drop-in replacement for React Native Alert API used in screens.
 */
export const AppAlert = {
    alert,
} as const;
