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
            text: isDark ? '#e0e0e0' : '#333',
            grid: isDark
                ? 'rgba(255,255,255,0.1)'
                : 'rgba(0,0,0,0.1)',
            background: isDark
                ? 'rgba(255,255,255,0.05)'
                : 'rgba(0,0,0,0.02)'
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
                            'rgba(255, 107, 107, 0.7)',

                        borderColor:
                            '#B5714B',

                        borderWidth: 2,

                        borderRadius: 4
                    },

                    {
                        label: 'Entrate',

                        data:
                            window.chartGiornalieroData.dataIngressi || [],

                        backgroundColor:
                            'rgba(78, 205, 196, 0.7)',

                        borderColor:
                            '#7C9473',

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
                            '#B5714B',

                        backgroundColor:
                            'rgba(255, 107, 107, 0.1)',

                        fill: true,

                        tension: 0.4,

                        pointBackgroundColor:
                            '#B5714B'
                    },

                    {
                        label: 'Entrate mensili',

                        data:
                            window.chartTrendData.dataIngressi || [],

                        borderColor:
                            '#7C9473',

                        backgroundColor:
                            'rgba(78, 205, 196, 0.1)',

                        fill: true,

                        tension: 0.4,

                        pointBackgroundColor:
                            '#7C9473'
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
            '#B5714B',
            '#7C9473',
            '#4C6B8A',
            '#9AB68C',
            '#C9A227',
            '#8A7B9E',
            '#C97B4A',
            '#6E88A6'
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