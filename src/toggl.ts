import { Me } from './me';
import { TimeEntry } from './timeEntry';
import { Invitations } from './invitations';
import { Projects } from './projects';
import { Tags } from './tags';
import { ResponseError, TogglRatelimitError } from './errors';

export class Toggl {
	public me = new Me(this);
	public timeEntry = new TimeEntry(this);
	public invitations = new Invitations(this);
	public projects = new Projects(this);
	public tags = new Tags(this);

	private baseURL: string;
	private headers: HeadersInit;

	private rateLimitedUntil: Date | null = null;

	constructor({
		auth,
		baseURL = 'https://api.track.toggl.com/api/v9',
		fetchInit = {},
	}: {
		auth: Auth;
		baseURL?: string;
		fetchInit?: RequestInit;
	}) {
		this.baseURL = baseURL;
		this.headers = {
			'Content-Type': 'application/json',
			Authorization: this.authHeader(auth),
			...fetchInit.headers,
		};
	}

	public async request<T = unknown>(
		endpoint: string,
		{
			body,
			query,
			method = 'GET',
			fetchInit = {},
		}: {
			body?: object;
			query?: Record<string, string | number | boolean | null | undefined>;
			method?: string;
			fetchInit?: RequestInit;
		} = {}
	) {
		const ratelimitResetIn = this.getRateLimitedUntil();
		if (ratelimitResetIn > 0) {
			throw new TogglRatelimitError(ratelimitResetIn);
		}
		const normalizedQuery: Record<string, string> = {};
		for (const key in query) {
			if (!query.hasOwnProperty(key)) continue;

			const val = query[key];
			if (val === undefined || val === null) continue;

			normalizedQuery[key] = `${val}`; // to string
		}
		const params = new URLSearchParams(normalizedQuery);
		const url = new URL(this.baseURL + '/' + endpoint);
		if (Array.from(params).length) {
			url.search = params.toString();
		}

		const response = await fetch(url, {
			method,
			body: body ? JSON.stringify(body) : undefined,
			headers: this.headers,
			...fetchInit,
		});

		if (!response.ok) {
			if (response.status === 402) {
				const resetIn = Number(
					response.headers.get('X-Toggl-Quota-Resets-In') || '0'
				);
				console.warn(`Ratelimit exceeded. Resets in ${resetIn} seconds.`);
				this.rateLimitedUntil = new Date(Date.now() + resetIn * 1000);
				throw new TogglRatelimitError(resetIn);
			}
			throw new ResponseError(
				`HTTP error! status: ${response.status}`,
				response
			);
		}

		// do not use response.json() directly to be able to log parsing errors
		const dataBody = await response.text();
		try {
			return JSON.parse(dataBody) as T;
		} catch (e) {
			console.error(
				`Failed to parse "${dataBody}" as JSON response: ${(e as Error).message}`
			);
			return dataBody as unknown as T;
		}
	}

	/**
	 *
	 * @returns number of seconds until ratelimit is cleared. 0 if no ratelimit exists
	 */
	public getRateLimitedUntil(): number {
		if (this.rateLimitedUntil) {
			if (this.rateLimitedUntil > new Date()) {
				return Math.ceil((this.rateLimitedUntil.getTime() - Date.now()) / 1000);
			} else {
				// clear outdated rate limit
				this.rateLimitedUntil = null;
			}
		}
		return 0;
	}

	private authHeader(auth: Auth): string {
		const isToken = 'token' in auth;

		const authSecret = isToken
			? `${auth.token}:api_token`
			: `${auth.email}:${auth.password}`;
		const authBase64 = Buffer.from(authSecret).toString('base64');
		const authHeader = `Basic ${authBase64}`;

		return authHeader;
	}
}

export interface BasicAuth {
	email: string;
	password: string;
}
export interface ApiToken {
	token: string;
}
export type Auth = BasicAuth | ApiToken;
