export function formatTime(iso: string | null | undefined): string {
      if (!iso) return "--";
        return new Date(iso).toLocaleTimeString('fr-FR', {
            timeZone: 'Europe/Paris',
                hour: '2-digit',
                    minute: '2-digit',
                      });
                      }

                      export function formatDate(iso: string | null | undefined): string {
                        if (!iso) return "--";
                          return new Date(iso).toLocaleDateString('fr-FR', {
                              timeZone: 'Europe/Paris',
                                });
                                }
