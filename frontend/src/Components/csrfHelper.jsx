import { useEffect, useState } from "react";

let cachedCsrfToken = "";
let csrfRequestPromise = null;

async function fetchCsrfToken(apiurl) {
  const response = await fetch(
    `${apiurl}/csrf-token`,
    {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `CSRF request failed: ${response.status}`
    );
  }

  const data = await response.json();

  if (
    typeof data.csrfToken !== "string" ||
    !data.csrfToken
  ) {
    throw new Error(
      "CSRF token missing from response"
    );
  }

  return data.csrfToken;
}

export function useCsrfToken(apiurl) {
  const [token, setToken] = useState("");

  useEffect(() => {
    let active = true;

    fetchCsrfToken(apiurl)
      .then((csrfToken) => {
        if (active) {
          setToken(csrfToken);
        }
      })
      .catch((error) => {
        console.error(
          "Failed to fetch CSRF token:",
          error
        );

        if (active) {
          setToken("");
        }
      });

    return () => {
      active = false;
    };
  }, [apiurl]);

  return token;
}

export async function csrfFetch(
  apiurl,
  path,
  options = {}
) {
  const method = String(
    options.method || "GET"
  ).toUpperCase();

  const unsafe = [
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
  ].includes(method);

  const makeRequest = async (token = "") => {
    const headers = new Headers(
      options.headers || {}
    );

    if (unsafe) {
      headers.set(
        "X-CSRF-Token",
        token
      );
    }

    return fetch(`${apiurl}${path}`, {
      ...options,
      method,
      credentials: "include",
      headers,
    });
  };

  if (!unsafe) {
    return makeRequest();
  }

  // Always ask the server for the token
  // belonging to the current session.
  let token = await fetchCsrfToken(apiurl);

  let response = await makeRequest(token);

  if (response.status !== 403) {
    return response;
  }

  let errorData;

  try {
    errorData = await response.clone().json();
  } catch {
    return response;
  }

  const csrfError =
    errorData?.code === "CSRF_HEADER_MISSING" ||
    errorData?.code === "CSRF_SESSION_TOKEN_MISSING" ||
    errorData?.code === "CSRF_TOKEN_INVALID";

  if (!csrfError) {
    return response;
  }

  // Ask the server again for the CSRF token
  // associated with whatever session now exists.
  token = await fetchCsrfToken(apiurl);

  // Retry once only.
  return makeRequest(token);
}