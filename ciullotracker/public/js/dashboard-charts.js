// dashboard-charts.js - Grafici migliorati per la dashboard
document.addEventListener('DOMContentLoaded', function() {
    // Tema chiaro/scuro per i grafici
    function getChartColors() {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        return {
            text: isDark ? '#e0e0e0' : '#333',
            grid: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
            background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'
        };
    }

    // 1. Grafico a torta - Categorie di spesa
    const ctxCategorie = document.getElementById('chartCategorie');
    if (ctxCategorie && window.chartCategorieData) {
        const colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
            '#DDA0DD', '#FF8A5C', '#A29BFE', '#FD79A8', '#00CEC9'
        ];
        
        new Chart(ctxCategorie, {
            type: 'doughnut',
            data: {
                labels: window.chartCategorieData.labels,
                datasets: [{
                    data: window.chartCategorieData.data,
                    backgroundColor: colors.slice(0, window.chartCategorieData.labels.length),
                    borderWidth: 2,
                    borderColor: 'var(--bg-primary)'
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: getChartColors().text,
                            padding: 20,
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((context.parsed / total) * 100).toFixed(1);
                                return `€${context.parsed.toFixed(2)} (${percentage}%)`;
                            }
                        }
                    }
                },
                cutout: '65%'
            }
        });
    }

    // 2. Grafico a barre - Andamento giornaliero
    const ctxGiornaliero = document.getElementById('chartGiornaliero');
    if (ctxGiornaliero && window.chartGiornalieroData) {
        new Chart(ctxGiornaliero, {
            type: 'bar',
            data: {
                labels: window.chartGiornalieroData.labels,
                datasets: [
                    {
                        label: 'Uscite',
                        data: window.chartGiornalieroData.dataUscite,
                        backgroundColor: 'rgba(255, 107, 107, 0.7)',
                        borderColor: '#FF6B6B',
                        borderWidth: 2,
                        borderRadius: 4
                    },
                    {
                        label: 'Entrate',
                        data: window.chartGiornalieroData.dataIngressi,
                        backgroundColor: 'rgba(78, 205, 196, 0.7)',
                        borderColor: '#4ECDC4',
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
                                return `${context.dataset.label}: €${context.parsed.y.toFixed(2)}`;
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
                                return '€' + value.toFixed(0);
                            }
                        },
                        beginAtZero: true
                    }
                }
            }
        });
    }

    // 3. Nuovo grafico - Trend mensile (se disponibile)
    const ctxTrend = document.getElementById('chartTrend');
    if (ctxTrend && window.chartTrendData) {
        new Chart(ctxTrend, {
            type: 'line',
            data: {
                labels: window.chartTrendData.labels,
                datasets: [
                    {
                        label: 'Uscite mensili',
                        data: window.chartTrendData.dataUscite,
                        borderColor: '#FF6B6B',
                        backgroundColor: 'rgba(255, 107, 107, 0.1)',
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: '#FF6B6B'
                    },
                    {
                        label: 'Entrate mensili',
                        data: window.chartTrendData.dataIngressi,
                        borderColor: '#4ECDC4',
                        backgroundColor: 'rgba(78, 205, 196, 0.1)',
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: '#4ECDC4'
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
                                return `${context.dataset.label}: €${context.parsed.y.toFixed(2)}`;
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
                                return '€' + value.toFixed(0);
                            }
                        },
                        beginAtZero: true
                    }
                }
            }
        });
    }

    // 4. Nuovo grafico - Distribuzione per utente
    const ctxUtenti = document.getElementById('chartUtenti');
    if (ctxUtenti && window.chartUtentiData) {
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
        
        new Chart(ctxUtenti, {
            type: 'bar',
            data: {
                labels: window.chartUtentiData.labels,
                datasets: [{
                    label: 'Spese per utente',
                    data: window.chartUtentiData.data,
                    backgroundColor: colors.slice(0, window.chartUtentiData.labels.length).map(c => c + 'CC'),
                    borderColor: colors.slice(0, window.chartUtentiData.labels.length),
                    borderWidth: 2,
                    borderRadius: 8
                }]
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
                                return `€${context.parsed.x.toFixed(2)}`;
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
                                return '€' + value.toFixed(0);
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