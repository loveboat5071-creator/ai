// Common style mappings for section titles
export const titleSizeClasses: Record<string, string> = {
    sm: 'text-xl sm:text-2xl',
    md: 'text-2xl sm:text-3xl',
    lg: 'text-3xl sm:text-4xl',
    xl: 'text-4xl sm:text-5xl',
};

export const titleColorClasses: Record<string, string> = {
    white: 'text-white',
    slate: 'text-slate-900',
    blue: 'text-blue-600',
    green: 'text-green-600',
    purple: 'text-purple-600',
    orange: 'text-orange-600',
    red: 'text-red-600',
};

export const getStyleClasses = (data: any, defaults?: { size?: string; color?: string }) => {
    const sizeClass = titleSizeClasses[data?.titleSize || defaults?.size || 'lg'];
    const colorClass = titleColorClasses[data?.titleColor || defaults?.color || 'slate'];
    return { sizeClass, colorClass };
};
