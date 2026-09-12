// dashboard-charts.js - Grafici migliorati per la dashboard
document.addEventListener('DOMContentLoaded', function() {

    // Evita che i grafici vengano inizializzati due volte.
    // dashboard.ejs contiene già il renderer principale.
    if (window.__ciulloDashboardChartsInitialized) return;

    if (typeof Chart === 'undefined') return;

    // Tema chiaro/scuro per i grafici
    function getChartColors() {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

        return {
            text: isDark ? '#E8EAED' : '#1F1F1F',
            grid: isDark
                ? 'rgba(255,255,255,0.12)'
                : 'rgba(31, 31, 31, 0.08)',
            background: isDark
                ? 'rgba(255,255,255,0.06)'
                : 'rgba(31, 31, 31, 0.04)'
        };
    }

    /*
     * IMPORTANTE:
     *
     * Il grafico principale delle categorie viene gestito
     * direttamente da dashboard.ejs perché deve supportare:
     *
     * CATEGORIA
     *     ↓ click
     * SOTTOCATEGORIA
     *
     * Questo file gestisce quindi solo i grafici aggiuntivi.
     */

    // ============================================================
    // 1. GRAFICO ANDAMENTO GIORNALIERO
    // ============================================================

    const ctxGiornaliero =
        document.getElementById('chartGiornaliero');

    if (
        ctxGiornaliero &&
        window.chartGiornalieroData
    ) {
        new Chart(ctxGiornaliero, {
            type: 'bar',

            data: {
                labels: window.chartGiornalieroData.labels || [],

                datasets: [
                    {
                        label: 'Uscite',

                        data:
                            window.chartGiornalieroData.dataUscite || [],

                        backgroundColor:
                            'rgba(217, 48, 37, 0.78)',

                        borderColor:
                            '#D93025',

                        borderWidth: 2,

                        borderRadius: 4
                    },

                    {
                        label: 'Entrate',

                        data:
                            window.chartGiornalieroData.dataIngressi || [],

                        backgroundColor:
                            'rgba(24, 128, 56, 0.78)',

                        borderColor:
                            '#188038',

                        borderWidth: 2,

                        borderRadius: 4
                    }
                ]
            },

            options: {
                responsive: true,

                plugins: {
                    legend: {
                        position: 'top',

                        labels: {
                            color: getChartColors().text,
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    },

                    tooltip: {
                        callbacks: {
                            label: function(context) {

                                const value =
                                    Number(context.parsed.y) || 0;

                                return (
                                    context.dataset.label +
                                    ': €' +
                                    value.toFixed(2)
                                );
                            }
                        }
                    }
                },

                scales: {
                    x: {
                        grid: {
                            color: getChartColors().grid
                        },

                        ticks: {
                            color: getChartColors().text,
                            maxTicksLimit: 15
                        }
                    },

                    y: {
                        grid: {
                            color: getChartColors().grid
                        },

                        ticks: {
                            color: getChartColors().text,

                            callback: function(value) {
                                return '€' +
                                    Number(value).toFixed(0);
                            }
                        },

                        beginAtZero: true
                    }
                }
            }
        });
    }


    // ============================================================
    // 2. TREND MENSILE
    // ============================================================

    const ctxTrend =
        document.getElementById('chartTrend');

    if (
        ctxTrend &&
        window.chartTrendData
    ) {
        new Chart(ctxTrend, {
            type: 'line',

            data: {
                labels:
                    window.chartTrendData.labels || [],

                datasets: [
                    {
                        label: 'Uscite mensili',

                        data:
                            window.chartTrendData.dataUscite || [],

                        borderColor:
                            '#D93025',

                        backgroundColor:
                            'rgba(217, 48, 37, 0.14)',

                        fill: true,

                        tension: 0.4,

                        pointBackgroundColor:
                            '#D93025'
                    },

                    {
                        label: 'Entrate mensili',

                        data:
                            window.chartTrendData.dataIngressi || [],

                        borderColor:
                            '#188038',

                        backgroundColor:
                            'rgba(24, 128, 56, 0.14)',

                        fill: true,

                        tension: 0.4,

                        pointBackgroundColor:
                            '#188038'
                    }
                ]
            },

            options: {
                responsive: true,

                plugins: {
                    legend: {
                        position: 'top',

                        labels: {
                            color: getChartColors().text,
                            usePointStyle: true
                        }
                    },

                    tooltip: {
                        callbacks: {
                            label: function(context) {

                                const value =
                                    Number(context.parsed.y) || 0;

                                return (
                                    context.dataset.label +
                                    ': €' +
                                    value.toFixed(2)
                                );
                            }
                        }
                    }
                },

                scales: {
                    x: {
                        grid: {
                            color: getChartColors().grid
                        },

                        ticks: {
                            color: getChartColors().text
                        }
                    },

                    y: {
                        grid: {
                            color: getChartColors().grid
                        },

                        ticks: {
                            color: getChartColors().text,

                            callback: function(value) {
                                return '€' +
                                    Number(value).toFixed(0);
                            }
                        },

                        beginAtZero: true
                    }
                }
            }
        });
    }


    // ============================================================
    // 3. DISTRIBUZIONE PER UTENTE
    // ============================================================

    const ctxUtenti =
        document.getElementById('chartUtenti');

    if (
        ctxUtenti &&
        window.chartUtentiData
    ) {
        const colors = [
            '#1A73E8',
            '#EA4335',
            '#FBBC05',
            '#34A853',
            '#8E24AA',
            '#00ACC1',
            '#E37400',
            '#5F6368'
        ];

        const labels =
            window.chartUtentiData.labels || [];

        const data =
            window.chartUtentiData.data || [];

        new Chart(ctxUtenti, {
            type: 'bar',

            data: {
                labels: labels,

                datasets: [
                    {
                        label: 'Spese per utente',

                        data: data,

                        backgroundColor:
                            colors
                                .slice(0, labels.length)
                                .map(function(c) {
                                    return c + 'CC';
                                }),

                        borderColor:
                            colors.slice(0, labels.length),

                        borderWidth: 2,

                        borderRadius: 8
                    }
                ]
            },

            options: {
                responsive: true,

                indexAxis: 'y',

                plugins: {
                    legend: {
                        display: false
                    },

                    tooltip: {
                        callbacks: {
                            label: function(context) {

                                const value =
                                    Number(context.parsed.x) || 0;

                                return '€' +
                                    value.toFixed(2);
                            }
                        }
                    }
                },

                scales: {
                    x: {
                        grid: {
                            color: getChartColors().grid
                        },

                        ticks: {
                            color: getChartColors().text,

                            callback: function(value) {
                                return '€' +
                                    Number(value).toFixed(0);
                            }
                        },

                        beginAtZero: true
                    },

                    y: {
                        grid: {
                            display: false
                        },

                        ticks: {
                            color: getChartColors().text
                        }
                    }
                }
            }
        });
    }

});