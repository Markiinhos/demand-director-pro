import { useState, useCallback, useRef } from "react";
import { onlyDigits } from "@/lib/document-utils";

export interface CepResult {
  street: string;
  neighborhood: string;
  city: string;
  state: string;
}

interface UseCepLookupReturn {
  lookup: (cep: string) => void;
  isLoading: boolean;
  error: string | null;
  result: CepResult | null;
}

/**
 * Hook para buscar endereço por CEP usando a API do ViaCEP.
 * Aplica debounce automático de 500ms e só busca quando o CEP tem 8 dígitos.
 */
export function useCepLookup(onResult?: (data: CepResult) => void): UseCepLookupReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CepResult | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const lookup = useCallback(
    (cep: string) => {
      const digits = onlyDigits(cep);

      // Limpar debounce anterior
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Abortar request anterior
      if (abortRef.current) {
        abortRef.current.abort();
      }

      // Só buscar se o CEP tem 8 dígitos
      if (digits.length !== 8) {
        setError(null);
        setResult(null);
        return;
      }

      debounceRef.current = setTimeout(async () => {
        setIsLoading(true);
        setError(null);

        const controller = new AbortController();
        abortRef.current = controller;

        try {
          const response = await fetch(
            `https://viacep.com.br/ws/${digits}/json/`,
            { signal: controller.signal }
          );

          if (!response.ok) {
            throw new Error("Erro ao buscar CEP");
          }

          const data = await response.json();

          if (data.erro) {
            setError("CEP não encontrado");
            setResult(null);
            return;
          }

          const parsed: CepResult = {
            street: data.logradouro || "",
            neighborhood: data.bairro || "",
            city: data.localidade || "",
            state: data.uf || "",
          };

          setResult(parsed);
          onResult?.(parsed);
        } catch (err: any) {
          if (err.name === "AbortError") return;
          setError("Erro ao buscar CEP. Tente novamente.");
          setResult(null);
        } finally {
          setIsLoading(false);
        }
      }, 500);
    },
    [onResult]
  );

  return { lookup, isLoading, error, result };
}
