export class ResponseError extends Error {
	public response: Response;
	constructor(message: string, response: Response) {
		super(message);
		this.name = this.constructor.name;
		this.response = response;

		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, this.constructor);
		}
	}
}

export class TogglRatelimitError extends Error {
	public resetAfterSeconds: number;

	constructor(resetAfterSeconds: number) {
		super('Ratelimit exceeded');
		this.name = this.constructor.name;
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, this.constructor);
		}
		this.resetAfterSeconds = resetAfterSeconds;
	}
}
export function isRatelimitError(err: unknown): err is TogglRatelimitError {
	return (
		err !== null &&
		typeof err === 'object' &&
		'resetAfterSeconds' in err &&
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		typeof (err as any).resetAfterSeconds === 'number'
	);
}
