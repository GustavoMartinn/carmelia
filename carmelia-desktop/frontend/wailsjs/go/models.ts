export namespace models {
	
	export class DefaultsConfig {
	    headers: Record<string, string>;
	
	    static createFrom(source: any = {}) {
	        return new DefaultsConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.headers = source["headers"];
	    }
	}
	export class FileTreeNode {
	    name: string;
	    path: string;
	    isDir: boolean;
	    method?: string;
	    children?: FileTreeNode[];
	
	    static createFrom(source: any = {}) {
	        return new FileTreeNode(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.path = source["path"];
	        this.isDir = source["isDir"];
	        this.method = source["method"];
	        this.children = this.convertValues(source["children"], FileTreeNode);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class FrameworkSource {
	    type: string;
	    source: string;
	    include?: string[];
	    exclude?: string[];
	
	    static createFrom(source: any = {}) {
	        return new FrameworkSource(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.source = source["source"];
	        this.include = source["include"];
	        this.exclude = source["exclude"];
	    }
	}
	export class GeneratorConfig {
	    bodyStyle: string;
	    includeComments: boolean;
	    includeValidation: boolean;
	
	    static createFrom(source: any = {}) {
	        return new GeneratorConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.bodyStyle = source["bodyStyle"];
	        this.includeComments = source["includeComments"];
	        this.includeValidation = source["includeValidation"];
	    }
	}
	export class HttpResponse {
	    status: number;
	    statusText: string;
	    headers: Record<string, string>;
	    body: string;
	    time: number;
	    size: number;
	
	    static createFrom(source: any = {}) {
	        return new HttpResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.status = source["status"];
	        this.statusText = source["statusText"];
	        this.headers = source["headers"];
	        this.body = source["body"];
	        this.time = source["time"];
	        this.size = source["size"];
	    }
	}
	export class RunnerConfig {
	    timeout: number;
	    followRedirects: boolean;
	    saveResponses: boolean;
	    responsesDir: string;
	
	    static createFrom(source: any = {}) {
	        return new RunnerConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.timeout = source["timeout"];
	        this.followRedirects = source["followRedirects"];
	        this.saveResponses = source["saveResponses"];
	        this.responsesDir = source["responsesDir"];
	    }
	}
	export class HttxConfig {
	    version: number;
	    frameworks: FrameworkSource[];
	    output: string;
	    generator: GeneratorConfig;
	    runner: RunnerConfig;
	    defaults: DefaultsConfig;
	
	    static createFrom(source: any = {}) {
	        return new HttxConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.version = source["version"];
	        this.frameworks = this.convertValues(source["frameworks"], FrameworkSource);
	        this.output = source["output"];
	        this.generator = this.convertValues(source["generator"], GeneratorConfig);
	        this.runner = this.convertValues(source["runner"], RunnerConfig);
	        this.defaults = this.convertValues(source["defaults"], DefaultsConfig);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ParsedHttpRequest {
	    method: string;
	    url: string;
	    headers: Record<string, string>;
	    body?: string;
	    comments: string[];
	
	    static createFrom(source: any = {}) {
	        return new ParsedHttpRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.method = source["method"];
	        this.url = source["url"];
	        this.headers = source["headers"];
	        this.body = source["body"];
	        this.comments = source["comments"];
	    }
	}
	export class RunResult {
	    request: ParsedHttpRequest;
	    response: HttpResponse;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new RunResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.request = this.convertValues(source["request"], ParsedHttpRequest);
	        this.response = this.convertValues(source["response"], HttpResponse);
	        this.error = source["error"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

