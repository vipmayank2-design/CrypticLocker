/*
    ============================================================
    CrypticLocker — Theme Init (flash-prevention)
    ============================================================
*/

(function () {

    'use strict';

    try {

        var savedTheme =
            window.localStorage.getItem(
                'cl-theme'
            );

        var theme = 'dark';

        if (savedTheme === 'light' || savedTheme === 'dark') {

            theme = savedTheme;

        } else if (savedTheme === 'system') {

            var isDark =
                window.matchMedia &&
                window.matchMedia('(prefers-color-scheme: dark)').matches;

            theme = isDark ? 'dark' : 'light';

        }

        document.documentElement.dataset.theme =
            theme;

    } catch (error) {

        document.documentElement.dataset.theme =
            'dark';

    }

}());
