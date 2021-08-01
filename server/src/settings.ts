export interface JStarSettings {
    jstarExecutable: string;
    maxNumberOfProblems: number;
    disableVarResolve: boolean;
    noRedefinedGlobals: boolean;
    disableUnreachPass: boolean;
    noUnusedArgs: boolean;
    disableUnusedPass: boolean;
    disableReturnPass: boolean;
    disableAccessPass: boolean;
}
