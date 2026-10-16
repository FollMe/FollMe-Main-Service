import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDateString, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateNested } from "class-validator";
import { MAX_TASKS, MAX_TASK_LABEL } from "../invitation.constants";

/** A thing to do, with the day it should be done by. */
export class TaskDTO {
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập việc cần làm' })
  @MaxLength(MAX_TASK_LABEL, { message: `Tối đa ${MAX_TASK_LABEL} ký tự` })
  label: string;

  @IsOptional()
  @IsDateString()
  due?: string;

  /** One of TASK_LINKS; an unknown one is dropped, not refused (the app may know newer pages). */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  link?: string;
}

/** Tasks to add at once (the starter list, or one of the host's own). */
export class ChecklistDTO {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_TASKS)
  @ValidateNested({ each: true })
  @Type(() => TaskDTO)
  items: TaskDTO[];
}

/** Only the given fields change; a null due date removes it. */
export class UpdateTaskDTO {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập việc cần làm' })
  @MaxLength(MAX_TASK_LABEL, { message: `Tối đa ${MAX_TASK_LABEL} ký tự` })
  label?: string;

  @IsOptional()
  @IsDateString()
  due?: string | null;

  @IsOptional()
  @IsBoolean()
  done?: boolean;
}
